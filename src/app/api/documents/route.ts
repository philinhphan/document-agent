import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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