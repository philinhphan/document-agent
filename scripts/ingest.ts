import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') }); // Load .env.local

const ingestData = async () => {
    const pdfPath = path.resolve(__dirname, '../data/sample-doc.pdf'); // Path to your PDF
    console.log(`Loading PDF from: ${pdfPath}`);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
        console.error("Missing Supabase or OpenAI environment variables.");
        process.exit(1);
    }

    try {
        // 1. Load Document
        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();
        console.log(`Loaded ${docs.length} document sections.`);
        if (docs.length === 0) {
            console.warn("No documents found in PDF.");
            return;
        }

        // Add filename metadata to each document chunk
        docs.forEach(doc => {
            doc.metadata = { ...doc.metadata, source: path.basename(pdfPath) };
        });


        // 2. Split Text
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000, // Adjust as needed
            chunkOverlap: 200, // Adjust as needed
        });
        const splitDocs = await splitter.splitDocuments(docs);
        console.log(`Split into ${splitDocs.length} chunks.`);

        // 3. Initialize Embeddings
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-3-small", // Match the vector dimension in Supabase
        });

        // 4. Initialize Supabase Client
        // Use ANON key for client-side vector store operations if RLS allows
        // Use SERVICE_ROLE key if you need admin privileges for insertion
        const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Or use SUPABASE_SERVICE_ROLE_KEY if needed
        );

        // 4.5. Ensure document record exists
        const filename = path.basename(pdfPath);
        console.log(`Checking for document record: ${filename}`);
        
        let documentId: string;
        const { data: existingDoc } = await supabaseClient
            .from('documents')
            .select('id')
            .eq('filename', filename)
            .single();

        if (existingDoc) {
            documentId = existingDoc.id;
            console.log(`Found existing document with ID: ${documentId}`);
        } else {
            // Create document record
            console.log('Creating new document record...');
            const { data: newDoc, error: createError } = await supabaseClient
                .from('documents')
                .insert({
                    filename: filename,
                    original_name: filename,
                    file_size: 0, // Unknown for standalone script
                    mime_type: 'application/pdf',
                    upload_timestamp: new Date().toISOString(),
                    status: 'processing'
                })
                .select('id')
                .single();

            if (createError || !newDoc) {
                throw new Error(`Failed to create document record: ${createError?.message}`);
            }

            documentId = newDoc.id;
            console.log(`Created new document with ID: ${documentId}`);
        }

        // 5. Create Vector Store and Add Documents
        console.log("Adding documents to Supabase Vector Store...");
        await SupabaseVectorStore.fromDocuments(splitDocs, embeddings, {
            client: supabaseClient,
            tableName: 'document_chunks',      // Match your table name
            queryName: 'match_documents', // Match your function name
        });

        // 6. Update chunks with document_id
        console.log("Updating chunks with document_id...");
        const { error: updateError } = await supabaseClient
            .from('document_chunks')
            .update({ document_id: documentId })
            .like('metadata->>source', filename);

        if (updateError) {
            console.error('Error updating chunks with document_id:', updateError);
        } else {
            console.log(`Successfully linked ${splitDocs.length} chunks to document ${documentId}`);
        }

        // Update document status to completed
        await supabaseClient
            .from('documents')
            .update({ 
                status: 'completed',
                chunks_processed: splitDocs.length
            })
            .eq('id', documentId);

        console.log("✅ Data ingestion complete!");

    } catch (error) {
        console.error("Error during ingestion:", error);
        process.exit(1);
    }
};

ingestData();