import { createClient } from '@supabase/supabase-js';

console.log('Testing page functionality...\n');

// Check environment variables
console.log('1. Environment Variables:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING');
console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'MISSING');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('\n❌ Environment variables missing from Node environment');
  console.log('   Next.js loads .env files automatically, but this script needs them manually');
  process.exit(1);
}

// Test Supabase connection
console.log('\n2. Testing Supabase Connection:');
try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  console.log('   ✓ Supabase client created');

  const { data, error } = await supabase
    .from('orgs')
    .select('url, displayName, iconUrl, industry')
    .order('displayName');

  if (error) {
    console.log('   ❌ Database query error:', error);
  } else {
    console.log('   ✓ Query successful');
    console.log('   ✓ Found', data.length, 'organizations');
    data.forEach(org => console.log('      -', org.displayName));
  }
} catch (error) {
  console.log('   ❌ Exception:', error.message);
}

console.log('\n3. Next Steps:');
console.log('   - Check browser console for client-side errors');
console.log('   - Look at the Network tab to see the actual error response');
console.log('   - The error might be in client-side hydration, not server-side rendering');
