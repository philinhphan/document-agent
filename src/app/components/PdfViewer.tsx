'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  filename: string;
  initialPage?: number;
  onClose: () => void;
  highlightSnippets?: string[];
  fallbackChunks?: string[];
}

export default function PdfViewer({
  filename,
  initialPage = 1,
  onClose,
  highlightSnippets,
  fallbackChunks
}: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch PDF URL from API
    const fetchPdfUrl = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/pdf?filename=${encodeURIComponent(filename)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`);
        }

        const data = await response.json();
        if (!data?.url) {
          throw new Error('PDF URL missing in response');
        }
        setPdfUrl(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();
  }, [filename]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(initialPage);
  };

  useEffect(() => {
    setPageNumber(initialPage);
  }, [initialPage]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev));
  };

  const highlightTextLayer = useCallback(() => {
    if (
      (!highlightSnippets || highlightSnippets.length === 0) &&
      (!fallbackChunks || fallbackChunks.length === 0)
    ) {
      return;
    }

    const textLayer = document.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) {
      console.log('Text layer not found');
      return;
    }

    const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];

    // Reset existing highlights before applying new ones
    spans.forEach((span) => {
      span.style.backgroundColor = '';
      span.style.color = '';
      span.style.padding = '';
      span.style.borderRadius = '';
      span.style.boxShadow = '';
    });

    const highlightSpan = (span: HTMLSpanElement) => {
      span.style.backgroundColor = '#fef08a';
      span.style.color = '#111827';
      span.style.padding = '1px 2px';
      span.style.borderRadius = '2px';
      span.style.boxShadow = '0 0 0 2px rgba(250, 204, 21, 0.35)';
    };

    const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
    const highlighted = new Set<HTMLSpanElement>();

    let totalHighlights = 0;

    const highlightSnippet = (snippet: string) => {
      const normalizedSnippet = normalize(snippet);
      if (!normalizedSnippet) {
        return;
      }

      // Try to find a contiguous sequence of spans that matches the snippet.
      for (let i = 0; i < spans.length; i += 1) {
        const spanSequence: HTMLSpanElement[] = [];
        let combinedText = '';

        for (let j = i; j < spans.length; j += 1) {
          const span = spans[j];
          const normalizedSpan = normalize(span.textContent || '');
          if (!normalizedSpan) {
            continue;
          }

          spanSequence.push(span);
          combinedText = `${combinedText} ${normalizedSpan}`.trim();

          if (combinedText.length >= normalizedSnippet.length) {
            if (combinedText.includes(normalizedSnippet)) {
              spanSequence.forEach((seqSpan) => {
                if (!highlighted.has(seqSpan)) {
                  highlightSpan(seqSpan);
                  highlighted.add(seqSpan);
                  totalHighlights += 1;
                }
              });
              return;
            }
            break;
          }
        }
      }

      // Fallback: highlight partial matches to show at least the relevant words
      for (const span of spans) {
        if (highlighted.has(span)) {
          continue;
        }

        const normalizedSpan = normalize(span.textContent || '');
        if (normalizedSpan.length > 3 && normalizedSnippet.includes(normalizedSpan)) {
          highlightSpan(span);
          highlighted.add(span);
          totalHighlights += 1;
        }
      }
    };

    const highlightChunk = (chunk: string) => {
      const normalizedChunk = normalize(chunk);
      if (!normalizedChunk) {
        return;
      }

      for (const span of spans) {
        const normalizedSpan = normalize(span.textContent || '');
        if (normalizedSpan.length > 3 && normalizedChunk.includes(normalizedSpan) && !highlighted.has(span)) {
          highlightSpan(span);
          highlighted.add(span);
          totalHighlights += 1;
        }
      }
    };

    if (highlightSnippets && highlightSnippets.length > 0) {
      highlightSnippets.forEach(highlightSnippet);
    } else if (fallbackChunks && fallbackChunks.length > 0) {
      fallbackChunks.forEach(highlightChunk);
    }

    console.log('Highlighted', totalHighlights, 'spans');
  }, [highlightSnippets, fallbackChunks]);

  useEffect(() => {
    if (
      (!highlightSnippets || highlightSnippets.length === 0) &&
      (!fallbackChunks || fallbackChunks.length === 0)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      highlightTextLayer();
    }, 500);

    return () => clearTimeout(timer);
  }, [highlightSnippets, fallbackChunks, pageNumber, highlightTextLayer]);

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {filename}
          </h2>
          {(highlightSnippets?.length || fallbackChunks?.length) && (
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="inline-block w-2 h-2 bg-yellow-300 rounded-full mr-1"></span>
              {highlightSnippets?.length
                ? `Source snippet highlighted (${highlightSnippets[0].length} chars)`
                : 'Relevant source chunk highlighted'}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 p-1.5 ml-2 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
          aria-label="Close PDF viewer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-4 bg-gray-100">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-700">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <p className="font-semibold">Error loading PDF</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && pdfUrl && (
            <div className="flex justify-center">
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
                error={
                  <div className="text-red-600 p-4">
                    Failed to load PDF document.
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  className="shadow-lg"
                />
              </Document>
            </div>
          )}
        </div>

      {/* Footer with page controls */}
      {numPages && (
        <div className="flex items-center justify-between p-3 border-t bg-white flex-shrink-0">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <div className="text-sm text-gray-700 font-medium">
            Page {pageNumber} of {numPages}
          </div>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
