import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await mkdir(dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filePath = path.join(dataDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Initialize Supabase client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      });
      throw new Error('Missing Supabase environment variables');
    }

    console.log('Initializing Supabase client with URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Upload file to Supabase Storage
    console.log('Attempting to upload file to Supabase Storage:', filename);
    const { data: storageData, error: storageError } = await supabaseClient
      .storage
      .from('documents')
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (storageError) {
      console.error('Error uploading to Supabase Storage:', {
        error: storageError,
        message: storageError.message
      });
      throw new Error(`Failed to upload to Supabase Storage: ${storageError.message}`);
    }

    if (!storageData) {
      console.error('No storage data returned from Supabase');
      throw new Error('Failed to upload to Supabase Storage: No data returned');
    }

    console.log('Successfully uploaded to Supabase Storage:', storageData);

    // Record the upload in Supabase
    const { error: uploadError } = await supabaseClient
      .from('documents')
      .insert([
        {
          filename: filename,
          original_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          upload_timestamp: new Date().toISOString(),
          status: 'uploaded',
          storage_path: storageData.path
        }
      ]);

    if (uploadError) {
      console.error('Error recording upload in Supabase:', uploadError);
      throw new Error(`Failed to record upload in database: ${uploadError.message}`);
    }

    return NextResponse.json({ 
      message: 'File uploaded successfully',
      filename: filename,
      storage_path: storageData.path
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error uploading file' },
      { status: 500 }
    );
  }
} 