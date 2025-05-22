import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();

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

    const pdfPath = path.join(process.cwd(), 'data', filename);
    console.log(`Processing PDF from: ${pdfPath}`);

    // 1. Load Document
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} document sections.`);
    
    if (docs.length === 0) {
      return NextResponse.json(
        { error: 'No content found in PDF' },
        { status: 400 }
      );
    }

    // Add filename metadata to each document chunk
    docs.forEach(doc => {
      doc.metadata = { ...doc.metadata, source: filename };
    });

    // 2. Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks.`);

    // 3. Initialize Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });

    // 4. Initialize Supabase Client
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // 5. Create Vector Store and Add Documents
    console.log("Adding documents to Supabase Vector Store...");
    await SupabaseVectorStore.fromDocuments(splitDocs, embeddings, {
      client: supabaseClient,
      tableName: 'documents',
      queryName: 'match_documents',
    });

    return NextResponse.json({
      message: 'Document processed and added to knowledge base successfully',
      chunks: splitDocs.length
    });

  } catch (error) {
    console.error('Error during ingestion:', error);
    return NextResponse.json(
      { error: 'Error processing document' },
      { status: 500 }
    );
  }
} 