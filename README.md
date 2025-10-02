# 🤖 AI Conversational Coach

An intelligent document assistant platform built for hackathon that enables organizations to upload PDF documents, extract knowledge, and interact with an AI-powered conversational coach. Built with Next.js, LangChain, and Supabase.

![Next.js](https://img.shields.io/badge/Next.js-15.3.1-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![LangChain](https://img.shields.io/badge/LangChain-0.3-green?style=flat-square)

## ✨ Key Features

### 📚 Multi-Tenant Document Management
- **Organization-based isolation**: Each organization has its own knowledge base
- **PDF Upload & Processing**: Upload PDF documents that are automatically chunked and embedded
- **Document Status Tracking**: Monitor upload, processing, and completion status
- **Safe Document Deletion**: Remove documents from the knowledge base with confirmation

### 💬 Intelligent Chat Interface
- **RAG-Powered Conversations**: Chat with your documents using Retrieval-Augmented Generation
- **Source Citations**: Every answer includes clickable source citations with page numbers
- **German Language Support**: Localized interface for German-speaking users
- **Smart Suggestions**: Context-aware question suggestions to guide conversations
- **Markdown Rendering**: Rich text formatting for assistant responses

### 📄 Interactive PDF Viewer
- **Split-Screen View**: Chat and view source documents side-by-side
- **Smart Highlighting**: Automatically highlights relevant text passages in PDFs
- **Page Navigation**: Jump directly to cited pages
- **Fallback Chunks**: Shows relevant text chunks when exact highlighting isn't available

### 📊 Executive Knowledge Dashboard
- **Executive Brief Generation**: AI-generated summaries of your document collection
- **Key Findings Extraction**: Automated identification of important insights
- **Risk & Alert Detection**: Highlights potential issues found in documents
- **Recommended Actions**: Actionable next steps based on document analysis
- **Document Outline**: Interactive hierarchical structure of document content
- **Coverage Metrics**: Track processing progress for sections and images
- **Export Options**: Export executive briefs to Markdown or PDF

### 🔍 Advanced Document Understanding
- **Semantic Search**: Vector-based similarity search using OpenAI embeddings
- **Confidence Scoring**: Each outline section has confidence levels (high/medium/low)
- **Multi-Modal Support**: Handles text, images, and tables in documents
- **Citation Tracking**: Maintains source and page references for all extracted information

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15 with React 19, Tailwind CSS
- **AI/ML**: LangChain, OpenAI GPT-4, OpenAI Embeddings
- **Database**: Supabase (PostgreSQL + pgvector)
- **PDF Processing**: pdf-parse, pdfjs-dist, react-pdf
- **Streaming**: Vercel AI SDK for real-time chat responses

### Project Structure
```
src/
├── app/
│   ├── [orgUrl]/
│   │   ├── chat/                 # Chat interface
│   │   ├── manage/knowledge/     # Document management
│   │   └── components/           # Shared components
│   └── api/
│       ├── chat/                 # RAG chat endpoint
│       ├── upload/               # File upload
│       ├── ingest/               # Document processing
│       ├── documents/            # Document CRUD
│       ├── highlight/            # PDF highlighting
│       ├── overview/             # Executive summaries
│       ├── chunks/               # Chunk retrieval
│       └── pdf/                  # PDF serving
└── lib/
    └── types/                    # TypeScript definitions
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Supabase account
- OpenAI API key

### Environment Setup
Create a `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### Database Setup
Your Supabase database needs the following tables:

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Organizations
create table orgs (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  displayName text,
  iconUrl text,
  industry text,
  created_at timestamp default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id),
  filename text not null,
  original_name text,
  file_size bigint,
  status text default 'uploaded',
  upload_timestamp timestamp default now(),
  chunks_processed integer,
  error_message text
);

-- Document chunks (embeddings)
create table document_chunks (
  id bigserial primary key,
  org_id uuid references orgs(id),
  document_id uuid references documents(id),
  chunk_number integer,
  text text,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamp default now()
);

-- Create index for vector similarity search
create index on document_chunks using ivfflat (embedding vector_cosine_ops);
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📖 Usage

### 1. Organization Selection
- Navigate to the home page
- Select your organization from the list
- Organizations are pre-configured in the Supabase `orgs` table

### 2. Upload Documents
1. Navigate to **Manage Knowledge** from the chat page
2. Switch to the **Upload** tab
3. Select a PDF file
4. Click "Upload and Process"
5. The document will be:
   - Uploaded to Supabase Storage
   - Split into semantic chunks
   - Embedded using OpenAI embeddings
   - Stored in the vector database

### 3. Chat with Documents
1. Type questions in German or English
2. The AI retrieves relevant document chunks
3. Generates contextual answers with source citations
4. Click on citations to view the source in the PDF viewer

### 4. View Executive Dashboard
1. Navigate to **Manage Knowledge**
2. View the **Overview** tab for:
   - Executive brief summary
   - Key findings with citations
   - Identified risks and alerts
   - Recommended actions
   - Document outline and structure
   - Coverage metrics

### 5. Export Reports
- Click **Export Markdown** to download as .md file
- Click **Print / PDF** to generate a printable version

## 🛠️ Scripts

```bash
# Development
npm run dev                       # Start dev server with Turbopack

# Production
npm run build                     # Build for production
npm start                         # Start production server

# Database
npm run update-types              # Generate TypeScript types from Supabase schema
npm run migrate                   # Run database migrations

# Utilities
npm run ingest                    # Manually ingest a document
npm run lint                      # Run ESLint
```

## 🔧 Configuration

### Customizing the AI Model
Edit the chat API route to use different models:

```typescript
// src/app/api/chat/route.ts
const model = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview", // Change model here
  temperature: 0.7,
  streaming: true,
});
```

### Adjusting Chunk Retrieval
Modify the number of retrieved chunks:

```typescript
// src/app/api/chat/route.ts
const results = await retriever.getRelevantDocuments(question, {
  k: 5, // Number of chunks to retrieve
});
```

## 🌟 Key Highlights for Judges

### Innovation
- **Context-aware highlighting**: Automatically finds and highlights the exact text passage that answers the user's question
- **Multi-level executive summaries**: Generates document overlines, key findings, risks, and recommendations automatically
- **Split-screen UX**: Seamless integration of chat and PDF viewing

### Technical Excellence
- **Vector search with pgvector**: Efficient semantic search over embeddings
- **Streaming responses**: Real-time AI responses using Vercel AI SDK
- **Type-safe**: Full TypeScript coverage with generated database types
- **Modern stack**: Next.js 15, React 19, App Router

### User Experience
- **Localized for sales teams**: German language support with domain-specific terminology
- **Citation-driven trust**: Every answer is backed by source citations
- **Progress tracking**: Visual feedback on document processing and coverage
- **Export flexibility**: Multiple export formats for sharing insights

## 🧪 Testing

```bash
# Test organization chat
npm run test:org-chat

# Debug vector search
npm run debug:vector-search
```

## 📦 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker
```bash
# Build
docker build -t ai-coach .

# Run
docker run -p 3000:3000 --env-file .env.local ai-coach
```

## 🤝 Contributing

This is a hackathon project. Contributions, ideas, and feedback are welcome!

## 📄 License

MIT License - feel free to use this project as inspiration for your own work.

## 🙏 Acknowledgments

- Built with [LangChain](https://langchain.com/) for RAG implementation
- Powered by [OpenAI](https://openai.com/) for embeddings and chat
- Database and auth by [Supabase](https://supabase.com/)
- UI components with [Tailwind CSS](https://tailwindcss.com/)

---

**Built for 913.ai AI Agents Hackathon** - Transforming document management with AI 🚀
