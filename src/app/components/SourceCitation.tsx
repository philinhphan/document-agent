'use client';

import React, { useState } from 'react';

interface SourceCitationProps {
  source: string;
  page: string | number;
  snippet?: string;
  onShowSource?: (source: string, page: number, snippet?: string) => void;
}

const SourceCitation: React.FC<SourceCitationProps> = ({ source, page, snippet, onShowSource }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShowSource) {
      setIsLoading(true);
      const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
      if (!isNaN(pageNum)) {
        await onShowSource(source, pageNum, snippet);
      }
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center ml-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-50"
      title="View source in PDF with highlighting"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : (
        <>
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="italic">Source</span>: {source}, <span className="italic">Page </span> {page}
        </>
      )}
    </button>
  );
};

export default SourceCitation; 
