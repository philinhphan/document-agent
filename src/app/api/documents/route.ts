import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { unlink } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgUrl = searchParams.get('orgUrl');

    if (!orgUrl) {
      return NextResponse.json(
        { error: 'Organization URL is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get organization ID
    const { data: org, error: orgError } = await supabaseClient
      .from('orgs')
      .select('id')
      .eq('url', orgUrl)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all documents for this organization
    const { data: documents, error: documentsError } = await supabaseClient
      .from('documents')
      .select('id, filename, original_name, file_size, status, upload_timestamp, chunks_processed, error_message')
      .eq('org_id', org.id)
      .order('upload_timestamp', { ascending: false });

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      documents: documents || []
    });
  } catch (error) {
    console.error('Error in documents API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const orgUrl = searchParams.get('orgUrl');

    if (!documentId || !orgUrl) {
      return NextResponse.json(
        { error: 'Document ID and Organization URL are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get organization ID to verify access
    const { data: org, error: orgError } = await supabaseClient
      .from('orgs')
      .select('id')
      .eq('url', orgUrl)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get document details to verify ownership and get filenames
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('id, filename, storage_path, org_id')
      .eq('id', documentId)
      .eq('org_id', org.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    console.log('Deleting document:', document);

    // 1. Delete document chunks from vector store
    const { error: chunksError } = await supabaseClient
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    if (chunksError) {
      console.error('Error deleting document chunks:', chunksError);
      // Continue with deletion even if chunks deletion fails
    }

    // 2. Delete file from Supabase Storage
    if (document.storage_path) {
      const { error: storageError } = await supabaseClient
        .storage
        .from('documents')
        .remove([document.filename]);

      if (storageError) {
        console.error('Error deleting from Supabase Storage:', storageError);
        // Continue with deletion even if storage deletion fails
      }
    }

    // 3. Delete local file
    try {
      const localFilePath = path.join(process.cwd(), 'data', document.filename);
      await unlink(localFilePath);
    } catch (fileError) {
      console.error('Error deleting local file:', fileError);
      // Continue with deletion even if local file deletion fails
    }

    // 4. Delete document record from database
    const { error: deleteError } = await supabaseClient
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      console.error('Error deleting document record:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error in document deletion:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error deleting document' },
      { status: 500 }
    );
  }
} 