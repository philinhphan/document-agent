'use client'; // This component needs client-side interactivity

import { useChat, Message } from 'ai/react'; // Vercel AI SDK hook
import ReactMarkdown from 'react-markdown';
import { useEffect, useRef, useState, use } from 'react';
import dynamic from 'next/dynamic';
import SourceCitation from '../../components/SourceCitation';

// Dynamically import PdfViewer with no SSR
const PdfViewer = dynamic(() => import('../../components/PdfViewer'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
    <div className="text-white">Loading PDF viewer...</div>
  </div>
});

// Add interface for suggestions
interface Suggestion {
  text: string;
  type: 'question' | 'response';
}

interface HighlightApiChunk {
  id: number;
  text: string;
  page: number | null;
  source: string | null;
}

interface HighlightApiResponse {
  highlight: {
    text: string;
    chunkId: number;
  } | null;
  chunks: HighlightApiChunk[];
}

// Custom component for handling source citations in markdown
const CitationComponent = ({
  children,
  snippet,
  onShowSource
}: {
  children: string;
  snippet?: string;
  onShowSource: (source: string, page: number, snippet?: string) => Promise<void>;
}) => {
  // Parse the citation text to extract source and page
  // Support both formats: "Page X" and "Page: X"
  const match = children.match(/\[Source: (.*?), Page:?\s*([^\]]+)\]/);
  if (match) {
    const [, source, pageText] = match;
    return <SourceCitation source={source} page={pageText} snippet={snippet} onShowSource={onShowSource} />;
  }
  return <>{children}</>;
};

const citationPattern = /\[Source: .*?, Page(?:\s*:\s*)?\s*[^\]]+\]/i;
const citationPatternGlobal = /\[Source: .*?, Page(?:\s*:\s*)?\s*[^\]]+\]/gi;
const citationSplitRegex = /(\[Source: .*?, Page(?:\s*:\s*)?\s*[^\]]+\])/gi;
const stripCitations = (text: string) => text.replace(/\[Source: .*?, Page(?:\s*:\s*)?\s*[^\]]+\]/gi, '');
const citationRegexSingle = /^\[Source: .*?, Page(?:\s*:\s*)?\s*[^\]]+\]$/i;

const hasCitationPattern = (text: string) => citationPattern.test(text);
const getCitationMatches = (text: string) => [...text.matchAll(citationPatternGlobal)];

const cleanWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

const extractRepresentativeSnippet = (text: string) => {
  const cleaned = cleanWhitespace(text);
  if (!cleaned) {
    return '';
  }

  const sentenceSplits = cleaned.split(/(?<=[.!?])\s+/);
  const candidate = sentenceSplits[sentenceSplits.length - 1]?.trim();

  if (candidate && candidate.length > 0) {
    return candidate;
  }

  const words = cleaned.split(' ');
  const maxWords = 35;
  if (words.length > maxWords) {
    return words.slice(words.length - maxWords).join(' ');
  }

  return cleaned;
};

const buildCitationData = (paragraph: string) => {
  const matches = getCitationMatches(paragraph);
  let cursor = 0;

  return matches.map((match) => {
    const citationText = match[0];
    const matchIndex = match.index ?? paragraph.indexOf(citationText, cursor);
    const snippetSource = matchIndex >= 0 ? paragraph.slice(cursor, matchIndex) : paragraph;
    cursor = matchIndex >= 0 ? matchIndex + citationText.length : cursor;

    return {
      citationText,
      snippet: extractRepresentativeSnippet(snippetSource)
    };
  });
};

// Component that renders markdown and handles citations
const MarkdownWithCitations = ({
  content,
  onShowSource
}: {
  content: string;
  onShowSource: (source: string, page: number, snippet?: string) => Promise<void>;
}) => {
  // Check if content has citations (support both "Page X" and "Page: X")
  if (!hasCitationPattern(content)) {
    // No citations, render markdown normally
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }

  // Split content at paragraph level to preserve list structure
  const paragraphs = content.split(/\n\n+/);

  return (
    <div>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const matches = getCitationMatches(paragraph);

        if (matches.length === 0) {
          return (
            <ReactMarkdown key={paragraphIndex}>
              {paragraph}
            </ReactMarkdown>
          );
        }

        const citationData = buildCitationData(paragraph);
        const hasListItems = /^\s*[\d+\-\*]/.test(paragraph);

        if (hasListItems) {
          const citationFreeContent = stripCitations(paragraph);

          return (
            <div key={paragraphIndex}>
              <ReactMarkdown>{citationFreeContent}</ReactMarkdown>
              {citationData.map((data, citIndex) => (
                <CitationComponent
                  key={`${paragraphIndex}-${citIndex}`}
                  snippet={data.snippet}
                  onShowSource={onShowSource}
                >
                  {data.citationText}
                </CitationComponent>
              ))}
            </div>
          );
        }

        const parts = paragraph.split(citationSplitRegex);
        let citationCounter = 0;

        return (
          <div key={paragraphIndex}>
            {parts.map((part, partIndex) => {
              const trimmedPart = part.trim();

              if (citationRegexSingle.test(trimmedPart)) {
                const data = citationData[citationCounter];
                citationCounter += 1;

                return (
                  <CitationComponent
                    key={`${paragraphIndex}-${partIndex}`}
                    snippet={data?.snippet}
                    onShowSource={onShowSource}
                  >
                    {trimmedPart}
                  </CitationComponent>
                );
              }

              if (trimmedPart) {
                return (
                  <ReactMarkdown key={`${paragraphIndex}-${partIndex}`}>
                    {part}
                  </ReactMarkdown>
                );
              }

              return null;
            })}
          </div>
        );
      })}
    </div>
  );
};

interface ChatPageProps {
  params: Promise<{ orgUrl: string }>;
}

export default function Chat({ params }: ChatPageProps) {
  const { orgUrl } = use(params);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: '/api/chat', // Points to our backend route
    body: {
      orgUrl, // Include organization context in API calls
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null); // Create a ref for the scroll target
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]); // Add state for suggestions
  const [pdfViewerState, setPdfViewerState] = useState<{
    filename: string;
    page: number;
    highlightSnippets?: string[];
    fallbackChunks?: string[];
  } | null>(null);

  const USER_NAME = "Alex"; // Hardcoded user name for MVP

  // Handle "Show Source" click to fetch chunks and open with highlighting
  const handleShowSource = async (source: string, page: number, snippet?: string) => {
    // Show the viewer immediately so the PDF can start loading while we resolve highlighting.
    setPdfViewerState({ filename: source, page });

    try {
      const response = await fetch('/api/highlight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: source,
          page,
          answerSnippet: snippet ?? '',
          orgUrl
        })
      });

      if (!response.ok) {
        console.error('Failed to fetch highlight snippet');
        return;
      }

      const data = (await response.json()) as HighlightApiResponse;

      const rawFallback = data.chunks
        ?.map((chunk) => chunk.text)
        .filter((text): text is string => typeof text === 'string' && text.trim().length > 0) ?? [];
      const fallbackChunks = rawFallback.length > 0 ? rawFallback : undefined;

      const highlightText = data.highlight?.text?.trim();

      if (highlightText) {
        setPdfViewerState({
          filename: source,
          page,
          highlightSnippets: [highlightText],
          fallbackChunks
        });
        return;
      }

      if (fallbackChunks && fallbackChunks.length > 0) {
        setPdfViewerState({ filename: source, page, fallbackChunks });
      }
    } catch (error) {
      console.error('Error fetching highlight data:', error);
      // Viewer already open; keep it without highlighting
    }
  };

  // Close PDF viewer
  const closePdfViewer = () => {
    setPdfViewerState(null);
  };

  // Send initial greeting message
  useEffect(() => {
    // Check if messages array is empty to prevent adding greeting multiple times
    // (e.g. on hot reloads in development)
    if (messages.length === 0) {
      const initialAssistantMessage: Message = {
        id: 'initial-greeting',
        role: 'assistant',
        content: `Hallo ${USER_NAME}! Wie kann ich dir helfen?`,
      };
      setMessages([initialAssistantMessage]);
      // Set initial suggestions
      setSuggestions([
        { text: "Was sind die wichtigsten Aspekte beim Sales, die ich beachten sollte?", type: 'question' },
        { text: "Kannst du mir Sales-Strategien beschreiben?", type: 'question' },
        { text: "Ich habe Probleme mit meiner Kommunikation in Sales.", type: 'response' }
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Function to scroll to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to handle suggestion click
  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.type === 'question') {
      // Set the input value to the suggestion text
      handleInputChange({ target: { value: suggestion.text } } as React.ChangeEvent<HTMLInputElement>);
    } else {
      // For response type suggestions, we might want to handle them differently
      // For now, we'll just set them as input as well
      handleInputChange({ target: { value: suggestion.text } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className="flex h-full w-full">
        {/* Chat Section */}
        <div className={`flex flex-col transition-all duration-300 ${pdfViewerState ? 'w-1/2' : 'w-full'}`}>
            {/* Message List */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-gray-50">
            {messages.length > 0 ? (
                messages.map((m: Message) => (
                    <div key={m.id} className={`flex ${
                        m.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                        <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                            m.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                        }`}>
                            <div className={m.role === 'assistant' ? 'prose prose-sm max-w-none' : ''}>
                                {m.role === 'user' ? (
                                    <div className="text-sm">{m.content}</div>
                                ) : (
                                    <MarkdownWithCitations content={m.content} onShowSource={handleShowSource} />
                                )}
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-400">No messages yet. Ask something!</p>
            )}
                <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="bg-white border-t px-4 py-3 shadow-lg">
            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                                suggestion.type === 'question'
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {suggestion.text}
                        </button>
                    ))}
                </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="text-red-500 text-xs p-2 border border-red-300 rounded mb-2 bg-red-50">
                <strong>Error:</strong> {error.message}
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex space-x-2">
                <input
                    className="flex-1 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-300 rounded-full placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
                    value={input}
                    placeholder="Stelle eine Frage..."
                    onChange={handleInputChange}
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    disabled={isLoading || !input.trim()}
                >
                    {isLoading ? '...' : 'Senden'}
                </button>
            </form>
            </div>
        </div>

        {/* PDF Viewer - Side Panel */}
        {pdfViewerState && (
          <div className="w-1/2 border-l border-gray-300 bg-white">
            <PdfViewer
              filename={pdfViewerState.filename}
              initialPage={pdfViewerState.page}
              highlightSnippets={pdfViewerState.highlightSnippets}
              fallbackChunks={pdfViewerState.fallbackChunks}
              onClose={closePdfViewer}
            />
          </div>
        )}
    </div>
  );
} 
