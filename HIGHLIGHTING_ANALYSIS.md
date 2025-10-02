# PDF Text Highlighting Analysis

## Current Architecture

### 1. Document Processing Flow (Ingest)
```
PDF Upload → PDFLoader → Text Splitting → Embeddings → Supabase Vector Store
```

**What's stored in `document_chunks` table:**
- `content`: The actual chunk text (1000 chars, 200 overlap)
- `embedding`: Vector embedding for similarity search
- `metadata`: JSON object containing:
  - `source`: filename
  - `page`: page number (from PDFLoader)
  - `orgUrl`: organization
  - `orgId`: organization ID

**Key limitation:** We only store PAGE NUMBER, not the exact position/coordinates within the page.

### 2. Retrieval Flow (Chat)
```
User Question → Embedding → Vector Search → Top 4 Chunks → Context for LLM → Response with Citations
```

**What the LLM sees:**
```
Chunk 1 (Source: file.pdf, Page: 5):
{chunk content - 1000 chars}

Chunk 2 (Source: file.pdf, Page: 5):
{chunk content - 1000 chars}
...
```

**What the LLM returns:**
- Natural language response
- Citations in format: `[Source: file.pdf, Page 5]`
- **Problem:** The citation only includes PAGE number, not the actual chunk text used

### 3. Current Citation System
- Citation format: `[Source: filename, Page X]`
- Clicking opens PDF at page X
- **No information about WHICH chunk text was actually used**

---

## Options for Implementing Highlighting

### Option 1: Pass Retrieved Chunks to Frontend (Recommended)
**Approach:**
1. Modify chat API to return metadata alongside the response
2. Include the retrieved chunks in a structured format
3. Frontend receives both LLM response AND the source chunks
4. Pass chunk text to PDF viewer for highlighting

**Implementation:**
```typescript
// Chat API Response Structure:
{
  response: "LLM generated text with [Source: file.pdf, Page 5]",
  sourceChunks: [
    {
      filename: "file.pdf",
      page: 5,
      text: "Actual 1000-char chunk text from page 5...",
      relevanceScore: 0.89
    },
    {
      filename: "file.pdf",
      page: 7,
      text: "Another chunk from page 7...",
      relevanceScore: 0.85
    }
  ]
}
```

**Pros:**
- Most accurate - highlights EXACT text used by LLM
- Can show multiple source chunks per citation
- User sees exactly what the AI "read"

**Cons:**
- Requires modifying the streaming response format
- More complex frontend handling
- Chunks might span multiple pages (with overlap)

---

### Option 2: Extract Text from Citation Context
**Approach:**
1. Parse the LLM response for text near citations
2. Extract sentences/paragraphs before `[Source: file.pdf, Page X]`
3. Pass that text snippet to PDF viewer

**Example:**
```
LLM: "The sales process involves 3 key steps: prospecting, qualification, and closing. [Source: sales.pdf, Page 12]"

Extract: "The sales process involves 3 key steps: prospecting, qualification, and closing."
Highlight: This text on page 12
```

**Pros:**
- No backend changes needed
- Simple to implement
- Works with existing citation format

**Cons:**
- INACCURATE - LLM paraphrases, doesn't quote exactly
- May highlight text that doesn't exist in PDF
- LLM might combine info from multiple chunks

---

### Option 3: Store and Return Chunk IDs with Citations
**Approach:**
1. Assign unique ID to each chunk in vector store
2. LLM includes chunk IDs in citations: `[Source: file.pdf, Page 5, ChunkID: abc123]`
3. Frontend fetches chunk text by ID when needed
4. Highlight the chunk text in PDF

**Implementation:**
```typescript
// Citation format:
[Source: file.pdf, Page 5, ChunkID: uuid-abc-123]

// New API endpoint:
GET /api/chunk/{chunkId}
→ Returns { text: "chunk content...", page: 5, filename: "file.pdf" }
```

**Pros:**
- Clean separation of concerns
- Can cache chunks
- Exact chunk text available

**Cons:**
- Requires LLM to follow strict citation format
- Need to modify prompt template
- LLM might not reliably include chunk IDs

---

### Option 4: Post-Processing to Match Chunks
**Approach:**
1. After LLM responds, re-run similarity search on the response
2. Find which chunks were most similar to response content
3. Return those chunks as sources
4. Highlight them in PDF

**Pros:**
- No changes to streaming
- Works retroactively

**Cons:**
- UNRELIABLE - might find wrong chunks
- Computationally expensive
- Can't guarantee accuracy

---

## Recommended Implementation: Option 1 (Modified)

### Step 1: Enhance Chat API to Include Metadata

**Modify `/api/chat/route.ts`:**

```typescript
// Store retrieved docs before RAG chain
let retrievedChunks: Document[] = [];

const getContextWithOrgFiltering = async (question: string) => {
    try {
        const docs = await retriever.invoke(question);
        retrievedChunks = docs; // Store for later
        return formatDocuments(docs);
    } catch (error) {
        return "No relevant documents found.";
    }
};

// After LLM response, append metadata
// Use custom transformer to inject metadata into stream
```

**Problem:** Streaming makes this complex. The Vercel AI SDK streams tokens, so we can't easily append metadata at the end.

**Solution:** Use response metadata/annotations feature:

```typescript
return LangChainAdapter.toDataStreamResponse(ragChainStream, {
  metadata: {
    sourceChunks: retrievedChunks.map(doc => ({
      filename: doc.metadata.source,
      page: doc.metadata.page,
      text: doc.pageContent,
    }))
  }
});
```

### Step 2: Update Frontend to Receive Chunks

The Vercel AI SDK `useChat` hook can access metadata:

```typescript
const { messages, data } = useChat({
  api: '/api/chat',
  body: { orgUrl },
});

// data contains the metadata with sourceChunks
```

### Step 3: Update Citation Component to Pass Chunk Text

```typescript
interface SourceCitationProps {
  source: string;
  page: number;
  chunkText?: string; // Add this
  onCitationClick?: (source: string, page: number, chunkText?: string) => void;
}
```

### Step 4: Update PDF Viewer Call

```typescript
<PdfViewer
  filename={pdfViewerState.filename}
  initialPage={pdfViewerState.page}
  chunkText={pdfViewerState.chunkText} // Pass the chunk
  onClose={closePdfViewer}
/>
```

---

## Alternative: Simpler Non-Streaming Approach

If highlighting is critical, consider making citations non-streaming:

1. User clicks citation
2. Frontend fetches `/api/chunks?filename=X&page=Y`
3. Backend searches vector store for chunks matching filename + page
4. Returns all chunks for that page
5. Frontend highlights all chunks on that page

**Implementation:**

```typescript
// New API: /api/chunks/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filename = searchParams.get('filename');
  const page = searchParams.get('page');

  // Query Supabase for chunks
  const { data } = await supabase
    .from('document_chunks')
    .select('content, metadata')
    .eq('metadata->>source', filename)
    .eq('metadata->>page', page);

  return NextResponse.json({ chunks: data });
}
```

This is **much simpler** and provides good UX:
- Shows ALL content from that page that's in the knowledge base
- No streaming modifications needed
- Easy to implement today

---

## Summary & Recommendation

**For MVP (Today):**
- Implement Option 1 Alternative (fetch chunks by page when citation clicked)
- Simple, accurate, works with existing architecture
- Shows user all relevant content from that page

**For Production (Future):**
- Implement full Option 1 with streaming metadata
- Requires deeper Vercel AI SDK integration
- Most accurate - shows exactly what LLM saw

**Current Limitation:**
- We only have PAGE numbers, not coordinates
- Highlighting will be text-based search on the page
- PDF.js will try to find and highlight the text
- May not be pixel-perfect but will be good enough

Would you like me to implement the simpler "fetch chunks by page" approach now?
