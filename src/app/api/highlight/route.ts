import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatOpenAI } from '@langchain/openai';

interface ChunkRecord {
  id: number;
  content: string | null;
  metadata: Record<string, unknown> | null;
}

const escapeForRegex = (value: string) => value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

const findDirectMatch = (chunks: ChunkRecord[], snippet: string) => {
  const cleanedSnippet = snippet.trim();
  if (!cleanedSnippet) {
    return null;
  }

  for (const chunk of chunks) {
    const content = chunk.content ?? '';
    if (!content) {
      continue;
    }

    if (content.includes(cleanedSnippet)) {
      return { text: cleanedSnippet, chunkId: chunk.id };
    }

    const pattern = escapeForRegex(cleanedSnippet).replace(/\s+/g, '\\s+');
    const regex = new RegExp(pattern, 'i');
    const match = content.match(regex);
    if (match && match[0]) {
      return { text: match[0], chunkId: chunk.id };
    }
  }

  return null;
};

const toNumberOrNull = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

const serializeChunks = (chunks: ChunkRecord[]) =>
  chunks.map((chunk) => {
    const metadata = chunk.metadata ?? {};
    const pageValue = toNumberOrNull((metadata as { page?: unknown }).page);
    const locPage = toNumberOrNull((metadata as { loc?: { pageNumber?: unknown } }).loc?.pageNumber);

    return {
      id: chunk.id,
      text: chunk.content ?? '',
      page: pageValue ?? locPage,
      source: toStringOrNull((metadata as { source?: unknown }).source)
    };
  });

const buildLlmPrompt = (answerSnippet: string, chunks: ChunkRecord[]) => {
  const chunkDescriptions = chunks
    .map((chunk, index) => `Chunk ${index} (id: ${chunk.id}):\n"""${chunk.content ?? ''}"""`)
    .join('\n\n');

  return `You will receive an answer snippet from an assistant and several source chunks that came from a PDF.\n\nReturn a JSON object with exactly these keys: "chunkIndex" (number) and "exactText" (string).\n- "chunkIndex" must be the zero-based index of the chunk provided below.\n- "exactText" must be a literal substring copied from that chunk (including casing and punctuation).\n- If there is no literal match, respond with {"chunkIndex": -1, "exactText": ""}.\n- Do not add explanations or commentary.\n\nAnswer snippet:\n"""${answerSnippet}"""\n\nSource chunks:\n${chunkDescriptions}`;
};

const parseLlmResponse = (raw: unknown) => {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          return (part as { text?: string }).text ?? '';
        }
        return '';
      })
      .join('');
  }

  if (typeof raw === 'object' && 'text' in raw) {
    return (raw as { text?: string }).text ?? '';
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, page, answerSnippet = '', orgUrl } = body ?? {};

    if (!filename || page === undefined) {
      return NextResponse.json({ error: 'filename and page are required' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const pageValue = typeof page === 'number' ? page.toString() : page;

    let query = supabase
      .from('document_chunks')
      .select('id, content, metadata')
      .eq('metadata->>source', filename)
      .eq('metadata->>page', pageValue);

    if (orgUrl) {
      query = query.eq('metadata->>orgUrl', orgUrl);
    }

    const { data: initialChunks, error } = await query;

    if (error) {
      console.error('Highlight API - error fetching chunks:', error);
      return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 });
    }

    let chunks = initialChunks ?? [];

    if (chunks.length === 0) {
      let fallbackQuery = supabase
        .from('document_chunks')
        .select('id, content, metadata')
        .eq('metadata->>source', filename)
        .limit(8);

      if (orgUrl) {
        fallbackQuery = fallbackQuery.eq('metadata->>orgUrl', orgUrl);
      }

      const { data: fallbackData } = await fallbackQuery;
      chunks = fallbackData ?? [];
    }

    if (chunks.length === 0) {
      return NextResponse.json({ highlight: null, chunks: [] });
    }

    const directMatch = answerSnippet ? findDirectMatch(chunks, answerSnippet) : null;

    if (directMatch) {
      return NextResponse.json({ highlight: directMatch, chunks: serializeChunks(chunks) });
    }

    let highlightResult: { text: string; chunkId: number } | null = null;

    if (answerSnippet && process.env.OPENAI_API_KEY) {
      try {
        const llm = new ChatOpenAI({
          openAIApiKey: process.env.OPENAI_API_KEY,
          modelName: 'gpt-4o-mini',
          temperature: 0
        });

        const prompt = buildLlmPrompt(answerSnippet, chunks);
        const llmResponse = await llm.invoke([
          { role: 'system', content: 'Extract literal supporting spans from source chunks.' },
          { role: 'user', content: prompt }
        ]);

        const rawContent = parseLlmResponse(llmResponse.content);
        if (rawContent) {
          const trimmed = rawContent.trim();
          const jsonStart = trimmed.indexOf('{');
          const jsonEnd = trimmed.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd >= jsonStart) {
            const maybeJson = trimmed.slice(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(maybeJson) as { chunkIndex: number; exactText: string };

            if (
              typeof parsed.chunkIndex === 'number' &&
              parsed.chunkIndex >= 0 &&
              parsed.chunkIndex < chunks.length &&
              typeof parsed.exactText === 'string'
            ) {
              const targetChunk = chunks[parsed.chunkIndex];
              const content = targetChunk.content ?? '';
              if (parsed.exactText && content.includes(parsed.exactText)) {
                highlightResult = { text: parsed.exactText, chunkId: targetChunk.id };
              }
            }
          }
        }
      } catch (llmError) {
        console.error('Highlight API - LLM extraction failed:', llmError);
      }
    }

    return NextResponse.json({
      highlight: highlightResult,
      chunks: serializeChunks(chunks)
    });
  } catch (error) {
    console.error('Highlight API - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
