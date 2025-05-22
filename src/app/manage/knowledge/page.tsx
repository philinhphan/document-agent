'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KnowledgeManagement() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus({ type: null, message: '' });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      // First, upload the file
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const { filename } = await uploadResponse.json();

      // Then, trigger the ingestion process
      const ingestResponse = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      if (!ingestResponse.ok) {
        throw new Error('Failed to ingest document');
      }

      setUploadStatus({
        type: 'success',
        message: 'Document uploaded and ingested successfully!',
      });
      setFile(null);
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Knowledge Management</h1>
        <button
          onClick={() => router.push('/chat')}
          className="px-4 py-2 text-sm bg-gray-800 text-white hover:bg-gray-700 rounded-md transition-colors"
        >
          Back to Chat
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Upload Document</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload a PDF document to be processed and added to the knowledge base.
          The document will be split into chunks and embedded for retrieval.
        </p>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-blue-600 hover:text-blue-700"
            >
              {file ? file.name : 'Choose a PDF file'}
            </label>
          </div>

          {uploadStatus.type && (
            <div
              className={`p-4 rounded-md ${
                uploadStatus.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {uploadStatus.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || isUploading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Processing...' : 'Upload and Process'}
          </button>
        </form>
      </div>
    </div>
  );
} 