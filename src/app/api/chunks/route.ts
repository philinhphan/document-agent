import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');
    const page = searchParams.get('page');

    if (!filename || !page) {
      return NextResponse.json(
        { error: 'Missing filename or page parameter' },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Query for chunks matching the filename and page
    // Note: We need to query the JSONB metadata column
    const { data: chunks, error } = await supabaseClient
      .from('document_chunks')
      .select('id, content, metadata')
      .eq('metadata->>source', filename)
      .eq('metadata->>page', page);

    if (error) {
      console.error('Error fetching chunks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chunks from database' },
        { status: 500 }
      );
    }

    // Format the chunks for the frontend
    const formattedChunks = chunks?.map(chunk => ({
      id: chunk.id,
      text: chunk.content,
      page: chunk.metadata?.page || page,
      source: chunk.metadata?.source || filename,
    })) || [];

    return NextResponse.json({
      chunks: formattedChunks,
      count: formattedChunks.length
    });

  } catch (error) {
    console.error('Error in chunks API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
