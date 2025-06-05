# Organization-Specific Routing Setup

This application has been adapted to support multiple organizations with organization-specific routing.

## Overview

The application now uses dynamic routing with organization URLs:
- `/[orgUrl]/chat` - Organization-specific chat interface
- `/[orgUrl]/manage/knowledge` - Organization-specific knowledge management
- `/` - Organization selection page

## Database Schema

### Required Tables

1. **orgs** - Organization information (already provided)
2. **documents** - Document storage with organization linking
3. **document_chunks** - Vector embeddings with organization metadata

## Setup Instructions

### 1. Run Database Migration

Add the `org_id` column to the documents table:

```bash
npm run migrate:add-org-id
```

Or manually run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);

CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);
```

### 2. Seed Sample Organizations

Add sample organizations for testing:

```bash
npm run seed:organizations
```

This will create three sample organizations:
- **Apple Inc.** - URL: `apple`
- **Google** - URL: `google`  
- **Tesla** - URL: `tesla`

### 3. Access the Application

After seeding, you can access:
- http://localhost:3000/ - Organization selection page
- http://localhost:3000/apple/chat - Apple-specific chat
- http://localhost:3000/google/chat - Google-specific chat
- http://localhost:3000/tesla/chat - Tesla-specific chat
- http://localhost:3000/apple/manage/knowledge - Apple knowledge management

## How It Works

### Organization Validation
- Each route validates the `orgUrl` parameter against the database
- Invalid organization URLs return a 404 page
- Organization context is provided to all child pages

### Document Isolation
- Documents uploaded through `/[orgUrl]/manage/knowledge` are associated with that organization
- Vector search is filtered by organization during chat
- Each organization sees only their own documents

### Organization Context in AI Responses
- The AI chat includes organization-specific context in responses
- Organization information (industry, customer segments, etc.) is included in the prompt
- Responses are tailored to the specific organization

## Adding New Organizations

### Via Database

Insert directly into the `orgs` table:

```sql
INSERT INTO orgs (
  "displayName", 
  "legalName", 
  url, 
  domains, 
  industry, 
  "customerSegments",
  "llmCompanyContext",
  keywords
) VALUES (
  'Your Company',
  'Your Company Inc.',
  'your-company',
  ARRAY['yourcompany.com'],
  'Your Industry',
  'Your Customer Segments',
  'Context about your company for the AI',
  ARRAY['keyword1', 'keyword2']
);
```

### Via Admin Interface (Future Enhancement)

An admin interface for managing organizations can be added later.

## API Changes

### Upload API (`/api/upload`)
- Now accepts `orgUrl` parameter
- Associates uploaded documents with the organization

### Ingest API (`/api/ingest`)
- Now accepts `orgUrl` parameter
- Adds organization metadata to document chunks

### Chat API (`/api/chat`)
- Now accepts `orgUrl` parameter
- Filters vector search by organization
- Includes organization context in AI prompts

## File Structure

```
src/app/
├── page.tsx                          # Organization selection
├── [orgUrl]/                         # Organization-specific routes
│   ├── layout.tsx                    # Organization validation & header
│   ├── chat/
│   │   └── page.tsx                  # Organization-specific chat
│   └── manage/
│       └── knowledge/
│           └── page.tsx              # Organization-specific knowledge management
├── api/
│   ├── chat/route.ts                 # Updated with org filtering
│   ├── upload/route.ts               # Updated with org association
│   └── ingest/route.ts               # Updated with org metadata
└── components/
    └── SourceCitation.tsx            # Unchanged
```

## Security Considerations

- Organization URLs should be validated against the database
- Row Level Security (RLS) should be enabled on Supabase tables
- Document access should be restricted by organization
- User authentication and authorization should be added for production use

## Future Enhancements

1. **User Management** - Associate users with organizations
2. **Admin Interface** - UI for managing organizations
3. **Subdomain Routing** - Use subdomains instead of path segments
4. **Organization Theming** - Custom branding per organization
5. **Usage Analytics** - Track usage per organization 