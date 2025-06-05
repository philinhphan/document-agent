import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

async function getOrganizations() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase environment variables not found');
    return [];
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: orgs, error } = await supabase
      .from('orgs')
      .select('url, displayName, iconUrl, industry')
      .order('displayName');

    if (error) {
      console.error('Error fetching organizations:', error);
      return [];
    }

    return orgs || [];
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }
}

export default async function HomePage() {
  const organizations = await getOrganizations();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Conversational Coach
          </h1>
          <p className="text-xl text-gray-600">
            Select your organization to get started
          </p>
        </div>

        {organizations.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Link
                key={org.url}
                href={`/${org.url}/chat`}
                className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-300"
              >
                <div className="flex items-center space-x-4">
                  {org.iconUrl && (
                    <img
                      src={org.iconUrl}
                      alt={`${org.displayName} logo`}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {org.displayName}
                    </h3>
                    {org.industry && (
                      <p className="text-sm text-gray-500">{org.industry}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-blue-600 hover:text-blue-800">
                    Start chatting →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No organizations found
            </h3>
            <p className="text-gray-500">
              No organizations are currently available. Please contact your administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 