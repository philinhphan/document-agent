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
const SYSTEM_TEMPLATE = `Du bist ein KI-Gesprächscoach, der ${USER_NAME} unterstützt. Dein Ziel ist es, eine natürliche, ermutigende und motivierende Gesprächsatmosphäre zu schaffen.

Deine Hauptmerkmale:
- Sei warmherzig und persönlich in deiner Kommunikation
- Erkenne und bestärke positive Fortschritte
- Zeige echtes Interesse an ${USER_NAME}'s Fragen und Bedürfnissen
- Verwende eine natürliche, gesprächige Sprache
- Gib konstruktives Feedback und praktische Vorschläge
- Ermutige zu weiteren Fragen und tiefergehenden Diskussionen

Versuche zuerst, Fragen basierend auf dem im folgenden Kontext bereitgestellten Wissen zu beantworten.
Wenn der Kontext die Antwort nicht enthält, kannst du dein Allgemeinwissen verwenden, um die Frage zu beantworten.
Sei prägnant und hilfreich. Erfinde keine Informationen, wenn du dich auf den Kontext verlässt.

WICHTIG: Wenn du Informationen aus dem Kontext verwendest, musst du die Quelle mit Seitenzahl zitieren. Verwende das Format [Source: filename.pdf, Page X] am Ende des relevanten Satzes oder Absatzes. Wenn du mehrere Quellen verwendest, zitiere jede Quelle separat.

Antworte in derselben Sprache wie die Frage.

{orgContext}

Kontext:
{context}

Frage:
{question}`;

// --- Helper Function ---
const formatDocuments = (docs: Document[]): string => {
    // Include source metadata and page numbers if available
    return docs.map((doc, i) => {
        const source = doc.metadata?.source || 'N/A';
        const page = doc.metadata?.page || 'N/A';
        return `Chunk ${i + 1} (Source: ${source}, Page: ${page}):\n${doc.pageContent}`;
    }).join("\n\n");
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
        const orgUrl = body.orgUrl;
        // const formattedPreviousMessages = formatVercelMessages(messages.slice(0, -1)); // Use if needing history (more complex)
        const currentMessageContent = messages[messages.length - 1]?.content;

        if (!currentMessageContent) {
            return new Response(JSON.stringify({ error: "No message content found" }), { status: 400 });
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "Missing environment variables" }), { status: 500 });
        }

        // --- Initialize Clients and Embeddings ---
        const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get organization context if orgUrl is provided
        let orgContext = '';
        if (orgUrl) {
            const { data: org } = await supabaseClient
                .from('orgs')
                .select('displayName, llmCompanyContext, industry, customerSegments')
                .eq('url', orgUrl)
                .single();
            
            if (org) {
                orgContext = `\n\nOrganization Context:
- Company: ${org.displayName}
- Industry: ${org.industry || 'Not specified'}
- Customer Segments: ${org.customerSegments || 'Not specified'}
${org.llmCompanyContext ? `- Additional Context: ${org.llmCompanyContext}` : ''}`;
            }
        }



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
            tableName: 'document_chunks',
            queryName: 'match_documents',
        });
        
        // Create retriever with organization-specific filtering
        const retriever = vectorStore.asRetriever({
             k: 4, // Retrieve top 4 relevant chunks
             searchType: "similarity", // Use similarity search
             filter: orgUrl ? { orgUrl: { eq: orgUrl } } : {}, // Filter by organization if provided
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
                // Pass the organization context
                orgContext: () => orgContext,
            },
            prompt,       // Format the prompt with context, question, and orgContext
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