import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'No filename provided' },
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

    // Get signed URL from Supabase Storage (valid for 1 hour)
    const { data, error } = await supabaseClient
      .storage
      .from('documents')
      .createSignedUrl(filename, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to get PDF URL' },
        { status: 500 }
      );
    }

    if (!data || !data.signedUrl) {
      return NextResponse.json(
        { error: 'No URL returned from Supabase' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });

  } catch (error) {
    console.error('Error in PDF API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
