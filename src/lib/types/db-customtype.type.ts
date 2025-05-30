export type DocumentChunkMetadata = {
  // Document identification
  source: string;
  pageNumber: number;
  totalPages: number;
  
  // PDF metadata
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  
  // Location information
  location: {
    lines: {
      from: number;
      to: number;
    };
  };
  
  // PDF version info
  pdfVersion?: string;
  pdfFormatVersion?: string;
  
  // Additional metadata
  isXfaPresent?: boolean;
  isAcroFormPresent?: boolean;
};
