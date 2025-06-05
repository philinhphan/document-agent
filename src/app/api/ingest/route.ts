import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@/utils/supabase/server";
import path from 'path';

export async function POST(request: NextRequest) {
  let filename: string | undefined;
  
  try {
    const { filename: requestFilename, orgUrl } = await request.json();
    filename = requestFilename;

    if (!filename) {
      return NextResponse.json(
        { error: 'No filename provided' },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      );
    }

    const supabase = await createClient()

    // Get organization information if orgUrl is provided
    let orgId = null;
    if (orgUrl) {
      const { data: org } = await supabase
        .from('orgs')
        .select('id, displayName')
        .eq('url', orgUrl)
        .single();
      
      if (org) {
        orgId = org.id;
      }
    }

    // Get the document ID for this filename
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('filename', filename)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found in database' },
        { status: 404 }
      );
    }

    const documentId = document.id;

    // Update status to processing
    const { error } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('filename', filename)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      );
    }

    const pdfPath = path.join(process.cwd(), 'data', filename);
    console.log(`Processing PDF from: ${pdfPath}`);

    // 1. Load Document
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} document sections.`);
    
    if (docs.length === 0) {
      // Update status to failed
      await supabase
        .from('documents')
        .update({ 
          status: 'failed',
          error_message: 'No content found in PDF'
        })
        .eq('filename', filename);

      return NextResponse.json(
        { error: 'No content found in PDF' },
        { status: 400 }
      );
    }

    // Add filename and organization metadata to each document chunk
    docs.forEach(doc => {
      doc.metadata = { 
        ...doc.metadata, 
        source: filename,
        page: doc.metadata.page || 'N/A', // Preserve the page number from PDFLoader
        orgUrl: orgUrl || null,
        orgId: orgId || null
      };
    });

    // 2. Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks.`);

    // Ensure page numbers and organization info are preserved in split documents
    splitDocs.forEach(doc => {
      if (!doc.metadata.page) {
        doc.metadata.page = 'N/A';
      }
      if (!doc.metadata.orgUrl && orgUrl) {
        doc.metadata.orgUrl = orgUrl;
      }
      if (!doc.metadata.orgId && orgId) {
        doc.metadata.orgId = orgId;
      }
    });

    // 3. Initialize Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });

    // 5. Create Vector Store and Add Documents
    console.log("Adding documents to Supabase Vector Store...");
    await SupabaseVectorStore.fromDocuments(splitDocs, embeddings, {
      client: supabase,
      tableName: 'document_chunks',
      queryName: 'match_documents',
    });

    // 6. Update all chunks for this document with the document_id
    console.log("Updating chunks with document_id...");
    const { error: updateError } = await supabase
      .from('document_chunks')
      .update({ document_id: documentId })
      .like('metadata->>source', filename);

    if (updateError) {
      console.error('Error updating chunks with document_id:', updateError);
      // Don't fail the whole process for this, just log it
    }

    // Update status to completed
    await supabase
      .from('documents')
      .update({ 
        status: 'completed',
        chunks_processed: splitDocs.length
      })
      .eq('filename', filename);

    return NextResponse.json({
      message: 'Document processed and added to knowledge base successfully',
      chunks: splitDocs.length
    });

  } catch (error) {
    console.error('Error during ingestion:', error);
    
    // Update status to failed
    if (filename) {
      const supabaseClient = await createClient();
      
      await supabaseClient
        .from('documents')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error during processing'
        })
        .eq('filename', filename);
    }

    return NextResponse.json(
      { error: 'Error processing document' },
      { status: 500 }
    );
  }
} 