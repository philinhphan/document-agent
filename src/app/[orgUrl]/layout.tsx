import { ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgUrl: string }>;
}

// Helper function to validate organization
async function validateOrganization(orgUrl: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase environment variables not found, skipping org validation');
    return null;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: org, error } = await supabase
      .from('orgs')
      .select('id, displayName, url, llmCompanyContext, iconUrl')
      .eq('url', orgUrl)
      .single();

    if (error || !org) {
      return null;
    }

    return org;
  } catch (error) {
    console.error('Error validating organization:', error);
    return null;
  }
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgUrl } = await params;
  
  // Validate that the organization exists
  const org = await validateOrganization(orgUrl);
  
  if (!org) {
    notFound();
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Organization Header */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              {org.iconUrl && (
                <img
                  src={org.iconUrl}
                  alt={`${org.displayName} logo`}
                  className="h-8 w-8 rounded-full"
                />
              )}
              <h1 className="text-lg font-semibold text-gray-900">
                {org.displayName}
              </h1>
            </div>
            <nav className="flex space-x-2">
              <a
                href={`/${orgUrl}/chat`}
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Chat
              </a>
              <a
                href={`/${orgUrl}/manage/knowledge`}
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Knowledge
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - takes remaining space */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
} 