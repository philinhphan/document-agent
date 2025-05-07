import { NextRequest } from 'next/server';
import { Message as VercelChatMessage, streamText } from 'ai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from '@supabase/supabase-js';
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { LangChainAdapter } from 'ai';

export const runtime = 'edge'; // Optional: Use edge runtime for speed

// --- Configuration ---
const USER_NAME = "Alex"; // Hardcoded user name for MVP
const SYSTEM_TEMPLATE = `You are an AI Conversational Coach assisting ${USER_NAME}.
You can only answer questions based on the knowledge provided in the context below.
If the context doesn't contain the answer, reply that you don't have that information.
Be concise and helpful. Do not make up information.
Refer to the source document if possible (available in the metadata).

Context:
{context}

Question:
{question}`;

// --- Helper Function ---
const formatDocuments = (docs: Document[]): string => {
    // Include source metadata if available
    return docs.map((doc, i) => `Chunk ${i + 1} (Source: ${doc.metadata?.source || 'N/A'}):\n${doc.pageContent}`).join("\n\n");
};

const formatVercelMessages = (chatHistory: VercelChatMessage[]) => {
  const formattedDialogueTurns = chatHistory.map((message) => {
    if (message.role === "user") {
      return `Human: ${message.content}`;
    } else if (message.role === "assistant") {
      return `Assistant: ${message.content}`;
    } else {
      return `${message.role}: ${message.content}`;
    }
  });
  return formattedDialogueTurns.join("\n");
};


// --- Main POST Handler ---
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const messages = body.messages ?? [];
        // const formattedPreviousMessages = formatVercelMessages(messages.slice(0, -1)); // Use if needing history (more complex)
        const currentMessageContent = messages[messages.length - 1]?.content;

        if (!currentMessageContent) {
            return new Response(JSON.stringify({ error: "No message content found" }), { status: 400 });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "Missing environment variables" }), { status: 500 });
        }

        // --- Initialize Clients and Embeddings ---
        const supabaseClient = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );



        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-3-small",
        });
        const llm = new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: 'gpt-4o-mini',
            temperature: 0.2, // Low temperature for factual answers
            streaming: true,
        });

        // --- Initialize Vector Store and Retriever ---
        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabaseClient,
            tableName: 'documents',
            queryName: 'match_documents',
        });
        const retriever = vectorStore.asRetriever({
             k: 4, // Retrieve top 4 relevant chunks
             searchType: "similarity", // Use similarity search
        });

        // --- Define Prompt and Chain ---
        const prompt = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE);

        // RAG Chain definition using LangChain Expression Language (LCEL)
        const ragChain = RunnableSequence.from([
            {
                // Retrieve context based on the question
                context: retriever.pipe(formatDocuments),
                // Pass the question through
                question: new RunnablePassthrough(),
            },
            prompt,       // Format the prompt with context and question
            llm,          // Call the LLM
            new StringOutputParser(), // Parse the LLM output to string
        ]);

        // --- Invoke Chain and Return Stream ---
        // Do not await the chain invocation when streaming
        const ragChainStream = await ragChain.stream(currentMessageContent); // Use .stream() for LCEL

        return LangChainAdapter.toDataStreamResponse(ragChainStream);

    } catch (e: any) {
        console.error("Chat API Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}