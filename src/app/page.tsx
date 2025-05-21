'use client'; // This component needs client-side interactivity

import { useChat, Message } from 'ai/react'; // Vercel AI SDK hook
import ReactMarkdown from 'react-markdown';
import { useEffect, useRef } from 'react'; // Import useEffect and useRef

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: '/api/chat', // Points to our backend route
  });
  const messagesEndRef = useRef<HTMLDivElement>(null); // Create a ref for the scroll target

  const USER_NAME = "Alex"; // Hardcoded user name for MVP

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

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold mb-4 text-center">AI Conversational Coach (MVP)</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">Ask questions about the ingested knowledge resources.</p>

        {/* Message List */}
        <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2 h-[60vh] border rounded-md p-4 bg-gray-50">
            {messages.length > 0 ? (
                messages.map((m: Message) => (
                    <div key={m.id} className={`whitespace-pre-wrap ${
                        m.role === 'user' ? 'text-right' : 'text-left'
                    }`}>
                        <div className={`inline-block px-4 py-2 rounded-lg ${
                            m.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-800'
                        }`}>
                            <div className={m.role === 'assistant' ? 'prose' : ''}>
                                {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-400">No messages yet. Ask something!</p>
            )}
            <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-red-500 text-sm p-2 border border-red-300 rounded mb-2">
            <strong>Error:</strong> {error.message}
          </div>
        )}


        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
                className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={input}
                placeholder="Ask a question..."
                onChange={handleInputChange}
                disabled={isLoading}
            />
            <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                disabled={isLoading || !input.trim()}
            >
                {isLoading ? 'Sending...' : 'Send'}
            </button>
        </form>
    </div>
  );
}