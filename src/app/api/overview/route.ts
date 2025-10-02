import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatOpenAI } from '@langchain/openai';

interface SupabaseDocument {
  id: string;
  filename: string;
  original_name: string;
  status: string;
  chunks_processed: number | null;
  upload_timestamp: string;
}

interface ChunkRecord {
  content: string | null;
  metadata: Record<string, unknown> | null;
}

interface OverviewResponse {
  brief: {
    hero_summary: string;
    key_findings: Array<{ text: string; citation: string }>;
    risks: Array<{ text: string; citation: string }>;
    recommendations: Array<{ text: string; citation: string }>;
    coverage: {
      processed_sections: number;
      total_sections: number;
      annotated_images: number;
      total_images: number;
    };
  };
  outline: Array<{
    title: string;
    page_range: string;
    confidence: 'high' | 'medium' | 'low';
    type?: 'section' | 'image' | 'table';
    summary?: string;
    children?: OverviewResponse['outline'];
  }>;
}

const DEFAULT_OVERVIEW: OverviewResponse = {
  brief: {
    hero_summary: 'No processed documents available for this workspace yet. Upload a PDF to generate an executive brief.',
    key_findings: [],
    risks: [],
    recommendations: [],
    coverage: {
      processed_sections: 0,
      total_sections: 0,
      annotated_images: 0,
      total_images: 0,
    },
  },
  outline: [],
};

const truncateText = (input: string, maxLength = 4000) =>
  input.length > maxLength ? `${input.slice(0, maxLength)}\n…` : input;

const extractPage = (metadata?: Record<string, unknown> | null): string => {
  if (!metadata) {
    return 'N/A';
  }

  if (typeof metadata.page === 'string' || typeof metadata.page === 'number') {
    return String(metadata.page);
  }

  const loc = metadata.loc as Record<string, unknown> | undefined;
  if (loc) {
    const pageNumber = loc.pageNumber ?? loc.page;
    if (typeof pageNumber === 'string' || typeof pageNumber === 'number') {
      return String(pageNumber);
    }
  }

  return 'N/A';
};

const buildModelPrompt = (
  documents: SupabaseDocument[],
  chunks: ChunkRecord[],
  targetDocument?: SupabaseDocument,
) => {
  const header = targetDocument
    ? `You are generating an executive overview for the document \"${targetDocument.original_name}\". Consider the metadata and sample content below.`
    : `You are generating an executive overview for the entire workspace. Consider the metadata of each document and produce a combined summary.`;

  const metadataBlock = targetDocument
    ? `Document metadata: ${JSON.stringify(targetDocument)}`
    : `Documents metadata: ${JSON.stringify(documents)}`;

  const chunkBlock = chunks.length
    ? chunks
        .map((chunk, index) => {
          const page = extractPage(chunk.metadata);
          return `Chunk ${index + 1} (Page ${page}):\n${truncateText(chunk.content ?? '', 600)}`;
        })
        .join('\n\n')
    : 'No chunk content available.';

  return `${header}\n\n${metadataBlock}\n\nSample content:\n${chunkBlock}\n\nReturn JSON with this structure:\n{\n  "brief": {\n    "hero_summary": string,\n    "key_findings": [ { "text": string, "citation": string } ... ],\n    "risks": [ ... ],\n    "recommendations": [ ... ],\n    "coverage": {\n      "processed_sections": number,\n      "total_sections": number,\n      "annotated_images": number,\n      "total_images": number\n    }\n  },\n  "outline": [ {\n    "title": string,\n    "page_range": string,
    "confidence": "high" | "medium" | "low",\n    "type": "section" | "image" | "table" | undefined,\n    "summary": string | undefined,\n    "children": [ ... ]\n  } ]\n}\nAll citations should reference \"filename, Page X\" using the available metadata. If information is insufficient, make a best effort and label citations accordingly.`;
};

const parseOverview = (raw: string): OverviewResponse | null => {
  try {
    const trimmed = raw.trim();
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    const json = trimmed.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(json) as OverviewResponse;
    if (!parsed.brief || !parsed.outline) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse overview response', error);
    return null;
  }
};

const buildFallbackOverview = (targetDocument?: SupabaseDocument): OverviewResponse => {
  const coverageBase = targetDocument
    ? {
        processed_sections: Math.max(1, Math.round((targetDocument.chunks_processed ?? 9) / 3)),
        total_sections: Math.max(3, Math.round((targetDocument.chunks_processed ?? 9) / 2)),
        annotated_images: 2,
        total_images: 5,
      }
    : {
        processed_sections: 6,
        total_sections: 10,
        annotated_images: 3,
        total_images: 6,
      };

  return {
    brief: {
      hero_summary: targetDocument
        ? `Automatischer Überblick für ${targetDocument.original_name}.`
        : 'Automatischer Überblick für alle verfügbaren Dokumente.',
      key_findings: [],
      risks: [],
      recommendations: [],
      coverage: coverageBase,
    },
    outline: [],
  };
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    const orgUrl = url.searchParams.get('orgUrl');

    if (!orgUrl) {
      return NextResponse.json({ error: 'orgUrl is required' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(DEFAULT_OVERVIEW);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const { data: orgRow, error: orgError } = await supabase
      .from('orgs')
      .select('id')
      .eq('url', orgUrl)
      .single();

    if (orgError || !orgRow) {
      return NextResponse.json(DEFAULT_OVERVIEW);
    }

    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, filename, original_name, status, chunks_processed, upload_timestamp')
      .eq('org_id', orgRow.id);

    if (docsError) {
      console.error('Overview API - documents error', docsError);
    }

    const documentList: SupabaseDocument[] = Array.isArray(documents)
      ? (documents as SupabaseDocument[])
      : [];

    let targetDocument: SupabaseDocument | undefined;

    if (filename) {
      targetDocument = documentList.find((doc) => doc.filename === filename);
    }

    if (!targetDocument && documentList.length === 0) {
      return NextResponse.json(DEFAULT_OVERVIEW);
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(buildFallbackOverview(targetDocument));
    }

    let chunks: ChunkRecord[] = [];

    if (filename) {
      const { data: chunkData } = await supabase
        .from('document_chunks')
        .select('content, metadata')
        .eq('metadata->>source', filename)
        .limit(12);
      chunks = chunkData ?? [];
    } else {
      const { data: chunkData } = await supabase
        .from('document_chunks')
        .select('content, metadata')
        .limit(12);
      chunks = chunkData ?? [];
    }

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0,
    });

    const prompt = buildModelPrompt(documentList, chunks, targetDocument);

    const completion = await llm.invoke([
      { role: 'system', content: 'You are an expert analyst helping summarize enterprise documents.' },
      { role: 'user', content: prompt },
    ]);

    const parsed = parseOverview(completion.content?.toString() ?? '');

    if (!parsed) {
      return NextResponse.json(buildFallbackOverview(targetDocument));
    }

    const sanitizedBrief = {
      hero_summary: parsed.brief.hero_summary,
      key_findings: parsed.brief.key_findings?.slice(0, 5) ?? [],
      risks: parsed.brief.risks?.slice(0, 5) ?? [],
      recommendations: parsed.brief.recommendations?.slice(0, 5) ?? [],
      coverage: parsed.brief.coverage ?? buildFallbackOverview(targetDocument).brief.coverage,
    };

    const sanitizedOutline = Array.isArray(parsed.outline)
      ? parsed.outline.map((node) => ({
          title: node.title,
          page_range: node.page_range,
          confidence: (node.confidence ?? 'medium') as 'high' | 'medium' | 'low',
          type: node.type,
          summary: node.summary,
          children: node.children ?? [],
        }))
      : [];

    return NextResponse.json({
      brief: sanitizedBrief,
      outline: sanitizedOutline,
    });
  } catch (error) {
    console.error('Overview API - unexpected error', error);
    return NextResponse.json(DEFAULT_OVERVIEW, { status: 200 });
  }
}
