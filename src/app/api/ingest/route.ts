import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import path from 'path';

export async function POST(request: NextRequest) {
  let filename: string | undefined;
  
  try {
    const { filename: requestFilename } = await request.json();
    filename = requestFilename;

    if (!filename) {
      return NextResponse.json(
        { error: 'No filename provided' },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      );
    }

    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Update status to processing
    await supabaseClient
      .from('document_uploads')
      .update({ status: 'processing' })
      .eq('filename', filename);

    const pdfPath = path.join(process.cwd(), 'data', filename);
    console.log(`Processing PDF from: ${pdfPath}`);

    // 1. Load Document
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} document sections.`);
    
    if (docs.length === 0) {
      // Update status to failed
      await supabaseClient
        .from('document_uploads')
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

    // Add filename metadata to each document chunk
    docs.forEach(doc => {
      doc.metadata = { 
        ...doc.metadata, 
        source: filename,
        page: doc.metadata.page || 'N/A' // Preserve the page number from PDFLoader
      };
    });

    // 2. Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks.`);

    // Ensure page numbers are preserved in split documents
    splitDocs.forEach(doc => {
      if (!doc.metadata.page) {
        doc.metadata.page = 'N/A';
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
      client: supabaseClient,
      tableName: 'documents',
      queryName: 'match_documents',
    });

    // Update status to completed
    await supabaseClient
      .from('document_uploads')
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
      const supabaseClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      );
      
      await supabaseClient
        .from('document_uploads')
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