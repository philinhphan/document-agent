'use client';

import { useState, use, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface KnowledgeManagementPageProps {
  params: Promise<{ orgUrl: string }>;
}

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface CitationRef {
  source: string;
  page: string;
}

interface ExecutiveBullet {
  id: string;
  text: string;
  citation: CitationRef;
}

interface OutlineNode {
  id: string;
  title: string;
  pageRange: string;
  confidence: ConfidenceLevel;
  type?: 'section' | 'image' | 'table';
  summary?: string;
  thumbnail?: string;
  children?: OutlineNode[];
}

interface Document {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  status: string;
  upload_timestamp: string;
  chunks_processed: number | null;
  error_message: string | null;
}

interface ExecutiveBrief {
  heroSummary: string;
  keyFindings: ExecutiveBullet[];
  risks: ExecutiveBullet[];
  recommendations: ExecutiveBullet[];
  coverage: {
    processedSections: number;
    totalSections: number;
    annotatedImages: number;
    totalImages: number;
  };
}

const DEFAULT_OVERVIEW_KEY = 'default';

const BASE_EXECUTIVE_BRIEF = {
  heroSummary:
    'Diese Dokumentensammlung beschreibt Sales-Strategien, operative Leitplanken und unterstützendes Material für Gespräche mit Unternehmenskunden. Der Agent fasst die wichtigsten Erkenntnisse zusammen und markiert offene Punkte, die zusätzlichen Review benötigen.',
  keyFindings: [
    {
      id: 'finding-1',
      text: 'Erfolgreiche Gespräche folgen einem klaren Ablauf: Vorbereitung, Bedarfsanalyse, Preisargumentation und Follow-up sind Pflichtbestandteile.',
      citation: { source: '1749201432895-suxxeed_salesbible.pdf', page: 'Page 6' }
    },
    {
      id: 'finding-2',
      text: 'Methoden wie Sandwich- und Divisionsmethode reduzieren Preisresistenz, indem sie den Nutzen mehrfach betonen.',
      citation: { source: '1749201432895-suxxeed_salesbible.pdf', page: 'Page 20' }
    },
    {
      id: 'finding-3',
      text: 'Ein klarer Nachfassplan steigert Abschlussquoten; Templates für E-Mail-Follow-ups sind im Anhang enthalten.',
      citation: { source: '1749201432895-suxxeed_salesbible.pdf', page: 'Page 32' }
    }
  ] satisfies ExecutiveBullet[],
  risks: [
    {
      id: 'risk-1',
      text: 'Roll-out erfordert Aktualisierung der Checklisten; aktuelle Versionen fehlen für 2025-Q1 Leads.',
      citation: { source: 'internal_gap_analysis.pdf', page: 'Page 4' }
    },
    {
      id: 'risk-2',
      text: 'Scanner-basierte Vertragsbeispiele enthalten unleserliche Passagen; OCR-Qualität prüfen bevor sie produktiv genutzt werden.',
      citation: { source: '1749201432895-suxxeed_salesbible.pdf', page: 'Appendix Image 3' }
    }
  ] satisfies ExecutiveBullet[],
  recommendations: [
    {
      id: 'rec-1',
      text: 'Create a battlecard addendum mit Best-Practice-Einwänden und den passenden Nutzenargumenten.',
      citation: { source: 'agent_training_notes.pdf', page: 'Section 2' }
    },
    {
      id: 'rec-2',
      text: 'Verknüpfe Follow-up-Mails mit CRM-Automation, um Erinnerungen für SDRs zu automatisieren.',
      citation: { source: 'crm_playbook.pdf', page: 'Page 11' }
    }
  ] satisfies ExecutiveBullet[],
  coverage: {
    processedSections: 18,
    totalSections: 24,
    annotatedImages: 12,
    totalImages: 18
  }
} satisfies ExecutiveBrief;

const EXECUTIVE_BRIEFS: Record<string, ExecutiveBrief> = {
  [DEFAULT_OVERVIEW_KEY]: BASE_EXECUTIVE_BRIEF,
  '1749201432895-suxxeed_salesbible.pdf': { ...BASE_EXECUTIVE_BRIEF }
};

const BASE_OUTLINE: OutlineNode[] = [
  {
    id: 'outline-1',
    title: '1. Vorbereitung',
    pageRange: 'Page 5-6',
    confidence: 'high',
    summary: 'Mental vorbereiten, Ziele definieren, Gesprächsleitfaden prüfen.',
    children: [
      {
        id: 'outline-1-1',
          title: 'Mentale Vorbereitung / Zielsetzung',
          pageRange: 'Page 5',
          confidence: 'high',
          summary: 'Minimal- und Maximalziel setzen, positive Haltung einnehmen.'
      }
    ]
  },
  {
    id: 'outline-2',
    title: '2. Bedarfsanalyse',
    pageRange: 'Page 10-12',
    confidence: 'high',
    summary: 'Fragetechniken, Discovery-Checklisten und Scoring-Schema erläutert.',
    children: [
      {
        id: 'outline-2-1',
        title: 'Discovery-Checkliste',
        pageRange: 'Page 11',
        confidence: 'medium',
        summary: 'Tabellenartige Liste mit zu erhobenen Kennzahlen.'
      },
      {
        id: 'outline-2-img',
        title: 'Persona Canvas (Image)',
        pageRange: 'Page 12',
        confidence: 'medium',
        type: 'image',
        thumbnail: '/images/persona-placeholder.png',
        summary: 'Visualisiert Kundensegmente und Trigger-Events.'
      }
    ]
  },
  {
    id: 'outline-3',
    title: '3. Preisargumentation',
    pageRange: 'Page 20-22',
    confidence: 'high',
    summary: 'Sandwich-, Divisions- und Wertrechnungsmethode anhand von Beispielen.',
    children: [
      {
        id: 'outline-3-1',
        title: 'Sandwichmethode',
        pageRange: 'Page 20',
        confidence: 'high'
      },
      {
        id: 'outline-3-2',
        title: 'Wertrechnungsmethode',
        pageRange: 'Page 21',
        confidence: 'medium'
      }
    ]
  },
  {
    id: 'outline-4',
    title: 'Appendix: Beleg- & Bildmaterial',
    pageRange: 'Page 30-35',
    confidence: 'medium',
    type: 'image',
    summary: 'Fotografierte Whiteboard-Notizen, unterschriebene Verträge, Pipeline Diagramme.'
  }
] satisfies OutlineNode[];

const OUTLINE_MAP: Record<string, OutlineNode[]> = {
  [DEFAULT_OVERVIEW_KEY]: BASE_OUTLINE,
  '1749201432895-suxxeed_salesbible.pdf': BASE_OUTLINE
};

const buildBriefFromDocument = (doc?: Document): ExecutiveBrief => {
  if (!doc) {
    return BASE_EXECUTIVE_BRIEF;
  }

  const totalSections = Math.max(8, Math.round((doc.chunks_processed ?? 12) / 3));
  const processedSections = doc.status === 'completed'
    ? totalSections
    : Math.max(1, Math.round(totalSections * 0.6));
  const totalImages = Math.max(4, Math.round(totalSections / 2));
  const annotatedImages = doc.status === 'completed'
    ? Math.max(2, Math.round(totalImages * 0.75))
    : Math.max(1, Math.round(totalImages * 0.4));

  return {
    heroSummary: `Zusammenfassung für ${doc.original_name}: Der Agent hat das Dokument analysiert und zentrale Aussagen für Vertriebsteams extrahiert.`,
    keyFindings: BASE_EXECUTIVE_BRIEF.keyFindings.map((item, index) => ({
      ...item,
      id: `${item.id}-${doc.id}`,
      text:
        index === 0
          ? `Kerngliederung von ${doc.original_name}: ${item.text}`
          : item.text
    })),
    risks: BASE_EXECUTIVE_BRIEF.risks.map((item) => ({
      ...item,
      id: `${item.id}-${doc.id}`
    })),
    recommendations: BASE_EXECUTIVE_BRIEF.recommendations.map((item) => ({
      ...item,
      id: `${item.id}-${doc.id}`
    })),
    coverage: {
      processedSections,
      totalSections,
      annotatedImages,
      totalImages
    }
  };
};

const buildOutlineFromDocument = (doc?: Document): OutlineNode[] => {
  if (!doc) {
    return BASE_OUTLINE;
  }

  return [
    {
      id: `outline-${doc.id}-intro`,
      title: `${doc.original_name} – Überblick`,
      pageRange: 'Page 1-3',
      confidence: doc.status === 'completed' ? 'high' : 'medium',
      summary: 'Automatisch generierte Einleitung mit wichtigsten Argumenten.'
    },
    {
      id: `outline-${doc.id}-core`,
      title: 'Kerninhalte & Leitfäden',
      pageRange: 'Page 4-17',
      confidence: doc.status === 'completed' ? 'high' : 'medium',
      summary: 'Checklisten, Gesprächsleitfäden und Templates für Vertriebsaktionen.',
      children: [
        {
          id: `outline-${doc.id}-core-methods`,
          title: 'Methoden & Frameworks',
          pageRange: 'Page 8-12',
          confidence: 'high'
        },
        {
          id: `outline-${doc.id}-core-scripts`,
          title: 'Talk Tracks & Scripts',
          pageRange: 'Page 13-17',
          confidence: 'medium'
        }
      ]
    },
    {
      id: `outline-${doc.id}-evidence`,
      title: 'Anhang & evidenzbasierte Beispiele',
      pageRange: 'Page 18+',
      confidence: 'medium',
      type: 'image',
      summary: 'Visuals (Charts, unterschriebene Verträge, Checklisten-Scans).' 
    }
  ];
};

const getExecutiveBrief = (docKey: string, docs: Document[] = []): ExecutiveBrief => {
  const doc = docs?.find((item) => item.filename === docKey);
  if (doc) {
    return buildBriefFromDocument(doc);
  }
  return EXECUTIVE_BRIEFS[docKey] ?? BASE_EXECUTIVE_BRIEF;
};

const getOutlineNodes = (docKey: string, docs: Document[] = []): OutlineNode[] => {
  const doc = docs?.find((item) => item.filename === docKey);
  if (doc) {
    return buildOutlineFromDocument(doc);
  }
  return OUTLINE_MAP[docKey] ?? BASE_OUTLINE;
};

export default function KnowledgeManagement({ params }: KnowledgeManagementPageProps) {
  const { orgUrl } = use(params);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'upload'>('overview');
  const [selectedDocKey, setSelectedDocKey] = useState<string>(DEFAULT_OVERVIEW_KEY);
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [overviewCache, setOverviewCache] = useState<Record<string, OverviewPayload>>({
    [DEFAULT_OVERVIEW_KEY]: {
      brief: BASE_EXECUTIVE_BRIEF,
      outline: BASE_OUTLINE
    }
  });
  const [overviewLoadingKey, setOverviewLoadingKey] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const router = useRouter();

  const activeBrief = useMemo(() => {
    const cached = overviewCache[selectedDocKey];
    if (cached) {
      return cached.brief;
    }
    return getExecutiveBrief(selectedDocKey, documents);
  }, [selectedDocKey, documents, overviewCache]);

  const outlineNodes = useMemo(() => {
    const cached = overviewCache[selectedDocKey];
    if (cached) {
      return cached.outline;
    }
    return getOutlineNodes(selectedDocKey, documents);
  }, [selectedDocKey, documents, overviewCache]);

  const findOutlineNode = (nodes: OutlineNode[], id: string): OutlineNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const match = findOutlineNode(node.children, id);
        if (match) {
          return match;
        }
      }
    }
    return null;
  };

  const selectedNode = selectedOutlineId ? findOutlineNode(outlineNodes, selectedOutlineId) : null;

  const processedCoverage = activeBrief.coverage.totalSections
    ? Math.round((activeBrief.coverage.processedSections / activeBrief.coverage.totalSections) * 100)
    : 0;

  const imageCoverage = activeBrief.coverage.totalImages
    ? Math.round((activeBrief.coverage.annotatedImages / activeBrief.coverage.totalImages) * 100)
    : 0;

  const confidenceBadge = (level: ConfidenceLevel) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const outlineMarker = (level: ConfidenceLevel) => {
    switch (level) {
      case 'high':
        return 'before:bg-green-500';
      case 'medium':
        return 'before:bg-amber-500';
      default:
        return 'before:bg-gray-400';
    }
  };

  const isOverviewLoading = overviewLoadingKey === selectedDocKey;

  const exportAsMarkdown = () => {
    const lines: string[] = [];
    lines.push(`# Executive Brief`);
    lines.push('');
    lines.push(activeBrief.heroSummary);
    lines.push('');
    lines.push('## Key Findings');
    activeBrief.keyFindings.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.text} (${item.citation.source}, ${item.citation.page})`);
    });
    lines.push('');
    lines.push('## Risks / Alerts');
    activeBrief.risks.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.text} (${item.citation.source}, ${item.citation.page})`);
    });
    lines.push('');
    lines.push('## Recommended Actions');
    activeBrief.recommendations.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.text} (${item.citation.source}, ${item.citation.page})`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = selectedDocKey === DEFAULT_OVERVIEW_KEY
      ? 'all-documents'
      : selectedDocKey.replace(/[^a-zA-Z0-9-_]/g, '_');
    link.download = `executive-brief-${suffix}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsPdf = () => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      return;
    }
    const suffix = selectedDocKey === DEFAULT_OVERVIEW_KEY
      ? 'All Documents'
      : selectedDocKey;
    popup.document.write(`<!DOCTYPE html><html><head><title>Executive Brief – ${suffix}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; }
        h1 { font-size: 24px; margin-bottom: 16px; }
        h2 { font-size: 18px; margin-top: 24px; }
        ul { margin-left: 18px; }
        li { margin-bottom: 8px; }
        .citation { color: #4b5563; font-size: 12px; }
      </style>
    </head><body>`);
    popup.document.write(`<h1>Executive Brief</h1><p>${activeBrief.heroSummary}</p>`);
    popup.document.write('<h2>Key Findings</h2><ul>');
    activeBrief.keyFindings.forEach((item) => {
      popup.document.write(`<li>${item.text}<div class="citation">${item.citation.source} — ${item.citation.page}</div></li>`);
    });
    popup.document.write('</ul><h2>Risks / Alerts</h2><ul>');
    activeBrief.risks.forEach((item) => {
      popup.document.write(`<li>${item.text}<div class="citation">${item.citation.source} — ${item.citation.page}</div></li>`);
    });
    popup.document.write('</ul><h2>Recommended Actions</h2><ul>');
    activeBrief.recommendations.forEach((item) => {
      popup.document.write(`<li>${item.text}<div class="citation">${item.citation.source} — ${item.citation.page}</div></li>`);
    });
    popup.document.write('</ul></body></html>');
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const renderOutlineNode = (node: OutlineNode, depth = 0) => {
    const isSelected = node.id === selectedOutlineId;
    const padding = depth * 12;
    return (
      <li key={node.id} className="mb-2">
        <button
          type="button"
          onClick={() => {
            setSelectedOutlineId(node.id);
            setActiveTab('overview');
          }}
          className={`w-full text-left rounded-md border px-3 py-2 flex flex-col gap-1 transition-colors before:block before:w-1 before:rounded-full ${
            isSelected ? 'border-blue-500 bg-blue-50/70' : 'border-gray-200 bg-white hover:bg-gray-50'
          } ${outlineMarker(node.confidence)}`}
          style={{ paddingLeft: padding + 16 }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              {node.title}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${confidenceBadge(node.confidence)}`}>
              {node.confidence === 'high' ? 'High' : node.confidence === 'medium' ? 'Medium' : 'Low'}
            </span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{node.pageRange}</span>
            {node.type === 'image' && <span className="inline-flex items-center text-amber-600">📷 Image</span>}
            {node.type === 'table' && <span className="inline-flex items-center text-emerald-600">📊 Table</span>}
          </div>
          {node.summary && (
            <p className="text-xs text-gray-600 leading-snug">
              {node.summary}
            </p>
          )}
        </button>
        {node.children && node.children.length > 0 && (
          <ul className="mt-2 ml-3 border-l border-dashed border-gray-200 pl-3">
            {node.children.map((child) => renderOutlineNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const fetchDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      const response = await fetch(`/api/documents?orgUrl=${orgUrl}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      } else {
        console.error('Failed to fetch documents');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgUrl]);

  useEffect(() => {
    if (documents.length > 0) {
      const defaultDocKey = documents[0].filename;
      setSelectedDocKey((current) => {
        const stillExists = documents.some((doc) => doc.filename === current);
        if (current === DEFAULT_OVERVIEW_KEY || !stillExists) {
          return defaultDocKey;
        }
        return current;
      });
    } else {
      setSelectedDocKey(DEFAULT_OVERVIEW_KEY);
    }
  }, [documents]);

  useEffect(() => {
    const nodes = getOutlineNodes(selectedDocKey, documents);
    setSelectedOutlineId(nodes[0]?.id ?? null);
  }, [selectedDocKey, documents]);

  useEffect(() => {
    const loadOverview = async (docKey: string) => {
      if (overviewCache[docKey]) {
        return;
      }

      setOverviewLoadingKey(docKey);
      setOverviewError(null);

      try {
        const params = new URLSearchParams({ orgUrl });
        if (docKey !== DEFAULT_OVERVIEW_KEY) {
          params.append('filename', docKey);
        }

        const response = await fetch(`/api/overview?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch overview (${response.status})`);
        }

        const payload = (await response.json()) as OverviewPayload;
        setOverviewCache((previous) => ({
          ...previous,
          [docKey]: payload
        }));
      } catch (error) {
        console.error('Failed to load overview', error);
        setOverviewError(error instanceof Error ? error.message : 'Unable to load overview');
        const fallback = {
          brief: getExecutiveBrief(docKey, documents),
          outline: getOutlineNodes(docKey, documents)
        };
        setOverviewCache((previous) => ({
          ...previous,
          [docKey]: fallback
        }));
      } finally {
        setOverviewLoadingKey((current) => (current === docKey ? null : current));
      }
    };

    loadOverview(selectedDocKey);
  }, [selectedDocKey, orgUrl, overviewCache, documents]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus({ type: null, message: '' });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      // First, upload the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgUrl', orgUrl);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const { filename } = await uploadResponse.json();

      // Then, trigger the ingestion process
      const ingestResponse = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, orgUrl }),
      });

      if (!ingestResponse.ok) {
        throw new Error('Failed to ingest document');
      }

      setUploadStatus({
        type: 'success',
        message: 'Document uploaded and ingested successfully!',
      });
      setFile(null);
      
      // Refresh the documents list
      fetchDocuments();
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"? This action cannot be undone and will remove the document from the knowledge base.`)) {
      return;
    }

    try {
      setDeletingDocumentId(documentId);
      
      const response = await fetch(`/api/documents?documentId=${documentId}&orgUrl=${orgUrl}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove document from local state
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        setUploadStatus({
          type: 'success',
          message: 'Document deleted successfully!',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete document',
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'uploaded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderDocumentsSection = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Uploaded Documents</h2>
        <button
          onClick={fetchDocuments}
          className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9H20m0 0V4m0 5l-2.5-2.5M4 20l2.5-2.5M4 15h.582a8.001 8.001 0 0015.356 2H20v5" />
          </svg>
          Refresh
        </button>
      </div>

      {isLoadingDocuments ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-700 mt-2">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-700">No documents uploaded yet for this organization.</p>
          <p className="text-sm text-gray-500 mt-2">Switch to the Upload tab to add your first file.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">File Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Upload Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Chunks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded bg-red-100 flex items-center justify-center">
                          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{doc.original_name}</div>
                        <div className="text-xs text-gray-500">{doc.filename}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.status)}`}>
                      {doc.status}
                    </span>
                    {doc.error_message && (
                      <div className="text-xs text-red-600 mt-1" title={doc.error_message}>
                        Error: {doc.error_message.length > 50 ? `${doc.error_message.substring(0, 50)}…` : doc.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatFileSize(doc.file_size)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(doc.upload_timestamp)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{doc.chunks_processed || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.original_name)}
                      disabled={deletingDocumentId === doc.id}
                      className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Delete document from knowledge base"
                    >
                      {deletingDocumentId === doc.id ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Deleting…
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Knowledge Base Summary</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Total documents: <strong>{documents.length}</strong> • Completed: <strong>{documents.filter((d) => d.status === 'completed').length}</strong> • Processing: <strong>{documents.filter((d) => d.status === 'processing').length}</strong> • Failed: <strong>{documents.filter((d) => d.status === 'failed').length}</strong>
                </p>
                <p className="mt-1">
                  Total chunks processed: <strong>{documents.reduce((sum, doc) => sum + (doc.chunks_processed || 0), 0)}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderUploadSection = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900">Upload New Document</h2>
      <p className="text-sm text-gray-700 mb-6">
        Upload a PDF document to be processed and added to the knowledge base. The document will be split into chunks and embedded for retrieval.
      </p>

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer text-blue-600 hover:text-blue-700">
            {file ? file.name : 'Choose a PDF file'}
          </label>
        </div>

        {uploadStatus.type && (
          <div
            className={`p-4 rounded-md ${
              uploadStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {uploadStatus.message}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || isUploading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Processing…' : 'Upload and Process'}
        </button>
      </form>
    </div>
  );

  const renderOverviewSection = () => (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow p-6">
        {isOverviewLoading && (
          <div className="flex items-center gap-2 text-xs text-blue-600 mb-4">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9H20m0 0V4m0 5l-2.5-2.5M4 20l2.5-2.5M4 15h.582a8.001 8.001 0 0015.356 2H20v5" />
            </svg>
            Generating updated summary…
          </div>
        )}
        {overviewError && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {overviewError}
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Executive Brief</h2>
              <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold uppercase tracking-wide">Document</span>
                <select
                  value={selectedDocKey}
                  onChange={(event) => setSelectedDocKey(event.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={DEFAULT_OVERVIEW_KEY}>All documents</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.filename}>
                      {doc.original_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-700 max-w-3xl">{activeBrief.heroSummary}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAsMarkdown}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8.414a2 2 0 00-.586-1.414l-4.414-4.414A2 2 0 0012.586 2H4zm6 3a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H7a1 1 0 110-2h3V6a1 1 0 011-1z" />
              </svg>
              Export Markdown
            </button>
            <button
              onClick={exportAsPdf}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 2a2 2 0 00-2 2v1H4a2 2 0 100 4h2v2H4a2 2 0 100 4h2v1a2 2 0 104 0v-1h2a2 2 0 100-4h-2v-2h2a2 2 0 100-4h-2V4a2 2 0 00-2-2z" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { title: 'Key Findings', items: activeBrief.keyFindings ?? [] },
            { title: 'Risks & Alerts', items: activeBrief.risks ?? [] },
            { title: 'Recommended Actions', items: activeBrief.recommendations ?? [] }
          ].map((card) => (
            <div key={card.title} className="border border-gray-200 rounded-lg p-4 h-full">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{card.title}</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {card.items.map((item, index) => (
                  <li key={item.id ?? `${card.title}-${index}`} className="leading-snug">
                    {item.text}
                    {item.citation?.source && item.citation?.page && (
                      <div className="text-xs text-blue-600 mt-1">
                        {item.citation.source} • {item.citation.page}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Coverage Snapshot</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Document Sections Processed</span>
              <span>{processedCoverage}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-green-500" style={{ width: `${processedCoverage}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {activeBrief.coverage.processedSections} von {activeBrief.coverage.totalSections} Kapiteln analysiert
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Images & Visuals Annotated</span>
              <span>{imageCoverage}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-amber-500" style={{ width: `${imageCoverage}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {activeBrief.coverage.annotatedImages} von {activeBrief.coverage.totalImages} Bildern annotiert
            </p>
          </div>
        </div>
      </section>

      {selectedNode && (
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Fokusabschnitt</h3>
              <p className="text-lg font-bold text-gray-800 mt-1">{selectedNode.title}</p>
              <div className="mt-2 text-xs text-gray-500">{selectedNode.pageRange}</div>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${confidenceBadge(selectedNode.confidence)}`}>
              {selectedNode.confidence === 'high' ? 'High Coverage' : selectedNode.confidence === 'medium' ? 'Partial Coverage' : 'Needs Review'}
            </span>
          </div>
          {selectedNode.summary && (
            <p className="text-sm text-gray-700 mt-4">{selectedNode.summary}</p>
          )}
          {selectedNode.type === 'image' && (
            <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 text-amber-600">📷 Visual reference captured</span>
              <span>Bounding box stored for downstream viewers.</span>
            </div>
          )}
        </section>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto py-12 px-4 lg:px-6">
        <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Workspace</h1>
          <p className="text-sm text-gray-600 mt-1">Überblick, Nachweise und Uploads für {orgUrl}</p>
        </div>
        <button
          onClick={() => router.push(`/${orgUrl}/chat`)}
          className="px-4 py-2 text-sm bg-gray-800 text-white hover:bg-gray-700 rounded-md transition-colors"
        >
          Back to Chat
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'documents', label: 'Documents' },
          { key: 'upload', label: 'Upload' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-semibold rounded-md border transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {activeTab === 'overview' && (
          <aside className="lg:w-80 xl:w-96 bg-white rounded-lg shadow p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Outline & Minimap</h2>
              <span className="text-xs text-gray-500">Agent coverage</span>
            </div>
            {outlineNodes.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-800">
                {outlineNodes.map((node) => renderOutlineNode(node))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">Keine Outline verfügbar.</p>
            )}
          </aside>
        )}

        <main className="flex-1 space-y-6">
          {activeTab === 'overview' && renderOverviewSection()}
          {activeTab === 'documents' && renderDocumentsSection()}
          {activeTab === 'upload' && renderUploadSection()}
        </main>
      </div>
      </div>
    </div>
  );
}
