'use client'; // This component needs client-side interactivity

import { useChat, Message } from 'ai/react'; // Vercel AI SDK hook

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat', // Points to our backend route
  });

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
                        <span className={`inline-block px-4 py-2 rounded-lg ${
                            m.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-800'
                        }`}>
                            {m.role === 'user' ? 'You: ' : 'Coach: '}
                            {m.content}
                        </span>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-400">No messages yet. Ask something!</p>
            )}
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