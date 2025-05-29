import React from 'react';

interface SourceCitationProps {
  source: string;
  page: string | number;
}

const SourceCitation: React.FC<SourceCitationProps> = ({ source, page }) => {
  return (
    <span className="inline-flex items-center ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
      <span className="italic">Source</span>: {source}, <span className="italic">Page </span> {page}
    </span>
  );
};

export default SourceCitation; 