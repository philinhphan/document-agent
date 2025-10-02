# 🚀 Quick Start Guide - AI Conversational Coach

This guide provides step-by-step instructions to get the project running locally.

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js 20+** installed ([Download here](https://nodejs.org/))
- A **Supabase account** ([Sign up here](https://supabase.com/))
- An **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))

## 🔧 Step 1: Environment Setup

### 1.1 Clone the Repository
```bash
git clone <your-repo-url>
cd document-agent
```

### 1.2 Create Environment File
Create a `.env.local` file in the root directory with the following variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional: LangSmith Tracing (for debugging)
LANGSMITH_TRACING=false
LANGSMITH_ENDPOINT="https://eu.api.smith.langchain.com"
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_PROJECT="your-project-name"
```

### 1.3 Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### 1.4 Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy it to `OPENAI_API_KEY` in your `.env.local` file

## 🗄️ Step 2: Database Setup

### 2.1 Enable pgvector Extension
In your Supabase SQL Editor, run:

```sql
create extension if not exists vector;
```

### 2.2 Create Tables
Run the following SQL in your Supabase SQL Editor:

```sql
-- Organizations table
create table orgs (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  displayName text,
  iconUrl text,
  industry text,
  created_at timestamp default now()
);

-- Documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id) on delete cascade,
  filename text not null,
  original_name text,
  file_size bigint,
  mime_type text,
  status text default 'uploaded',
  upload_timestamp timestamp default now(),
  chunks_processed integer default 0,
  error_message text
);

-- Document chunks (embeddings)
create table document_chunks (
  id bigserial primary key,
  org_id uuid references orgs(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  chunk_number integer,
  text text,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamp default now()
);

-- Create index for fast vector similarity search
create index on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Create index for document lookups
create index on document_chunks (document_id);
create index on document_chunks (org_id);
```

### 2.3 Create Vector Search Function
```sql
-- Function for vector similarity search
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  filter_org_id uuid default null
)
returns table (
  id bigint,
  text text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.text,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where
    (filter_org_id is null or document_chunks.org_id = filter_org_id)
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### 2.4 Insert Sample Organization
```sql
-- Create a test organization
insert into orgs (url, displayName, industry)
values ('demo-org', 'Demo Organization', 'Technology');
```

### 2.5 Set Up Storage Bucket (Optional)
If using Supabase Storage for PDFs:

1. Go to **Storage** in Supabase Dashboard
2. Create a new bucket named `documents`
3. Set bucket to **Public** or configure RLS policies

## 📦 Step 3: Install Dependencies

```bash
npm install
```

Or using yarn:
```bash
yarn install
```

Or using pnpm:
```bash
pnpm install
```

## 🏃 Step 4: Run the Development Server

```bash
npm run dev
```

The application will be available at **http://localhost:3000**

## 🧪 Step 5: Test the Installation

### 5.1 Test Organization Access
1. Open http://localhost:3000
2. You should see the organization selection page
3. Select "Demo Organization"

### 5.2 Upload a Test Document
1. Place a PDF file in the `data/` folder (e.g., `data/sample-doc.pdf`)
2. Run the ingestion script:
   ```bash
   npm run ingest
   ```
3. This will:
   - Load the PDF
   - Split it into chunks
   - Generate embeddings
   - Store in Supabase

### 5.3 Test the Chat Interface
1. Navigate to the chat page: http://localhost:3000/demo-org/chat
2. Upload a document via the **Manage Knowledge** → **Upload** tab
3. Ask questions about your document
4. Verify you get responses with source citations

### 5.4 Run Test Scripts
```bash
# Test organization chat functionality
npm run test:org-chat

# Debug vector search
npm run debug:vector-search
```

## 🎯 Example Task: Complete Workflow

Here's a complete example to reproduce the main functionality:

### Step 1: Prepare a Test Document
Save a PDF file as `data/sample-doc.pdf` (or use any PDF you have)

### Step 2: Ingest the Document
```bash
npm run ingest
```

Expected output:
```
Loading PDF from: /path/to/data/sample-doc.pdf
Loaded 1 document sections.
Split into 15 chunks.
Adding documents to Supabase Vector Store...
✅ Data ingestion complete!
```

### Step 3: Access the Application
1. Open http://localhost:3000
2. Select your organization (demo-org)
3. You'll be redirected to the chat interface

### Step 4: Upload via Web Interface
1. Click **Manage Knowledge**
2. Go to **Upload** tab
3. Select a PDF file
4. Click **Upload and Process**
5. Wait for processing to complete (status will change to "completed")

### Step 5: Chat with Your Documents
1. Return to the **Chat** tab
2. Ask questions like:
   - "What is this document about?"
   - "Summarize the main points"
   - "What are the key findings?"
3. Click on citations to view source passages in the PDF viewer

### Step 6: View Executive Dashboard
1. Go to **Manage Knowledge** → **Overview** tab
2. View auto-generated:
   - Executive brief
   - Key findings
   - Risks and alerts
   - Recommended actions
   - Document outline

### Step 7: Export Results
- Click **Export Markdown** to download as .md
- Click **Print / PDF** to generate a PDF version

## 🔍 Troubleshooting

### Issue: "Missing Supabase or OpenAI environment variables"
**Solution**: Verify your `.env.local` file exists and contains all required variables

### Issue: Vector search returns no results
**Solution**:
1. Check that embeddings were created: `npm run debug:vector-search`
2. Verify the pgvector extension is enabled
3. Check the `match_documents` function exists

### Issue: PDF upload fails
**Solution**:
1. Check file size (should be < 10MB for free tier)
2. Verify Storage bucket exists and has correct permissions
3. Check browser console for error messages

### Issue: Chat responses are slow
**Solution**:
1. Check your OpenAI API quota
2. Verify network connection
3. Consider reducing chunk retrieval count in `src/app/api/chat/route.ts`

### Issue: TypeScript errors
**Solution**:
```bash
npm run update-types
```

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build production bundle |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run ingest` | Manually ingest a PDF from `data/` folder |
| `npm run test:org-chat` | Test organization chat functionality |
| `npm run debug:vector-search` | Debug vector search queries |
| `npm run update-types` | Generate TypeScript types from Supabase schema |

## 🛠️ Configuration

### Change AI Model
Edit `src/app/api/chat/route.ts`:
```typescript
const model = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview", // or "gpt-4o", "gpt-3.5-turbo"
  temperature: 0.7,
  streaming: true,
});
```

### Adjust Chunk Size
Edit `scripts/ingest.ts`:
```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,    // Characters per chunk
  chunkOverlap: 200,  // Overlap between chunks
});
```

### Change Retrieval Count
Edit `src/app/api/chat/route.ts`:
```typescript
const results = await retriever.getRelevantDocuments(question, {
  k: 5, // Number of chunks to retrieve
});
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)
1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com/)
3. Add environment variables from `.env.local`
4. Deploy

### Local Production Build
```bash
npm run build
npm start
```

## 🎉 Success Checklist

- [ ] `.env.local` file created with all credentials
- [ ] Supabase database tables created
- [ ] pgvector extension enabled
- [ ] `match_documents` function created
- [ ] Dependencies installed (`npm install`)
- [ ] Dev server running (`npm run dev`)
- [ ] Test document ingested (`npm run ingest`)
- [ ] Organization accessible at http://localhost:3000
- [ ] Document uploaded via web interface
- [ ] Chat responding with citations
- [ ] Executive dashboard showing overview

## 📞 Need Help?

- Check the [README.md](./README.md) for architecture details
- Review the [HIGHLIGHTING_ANALYSIS.md](./HIGHLIGHTING_ANALYSIS.md) for highlighting system details
- Check Supabase logs for database errors
- Review browser console for frontend errors

---

**Happy hacking! 🚀** Built for 913.ai AI Agents Hackathon
