import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testOrgSpecificRAG() {
  console.log('🧪 Testing Organization-Specific RAG Retrieval...\n');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-small",
  });

  try {
    // Get available organizations
    const { data: orgs } = await supabase
      .from('orgs')
      .select('url, displayName')
      .order('displayName');

    if (!orgs || orgs.length === 0) {
      console.log('❌ No organizations found. Run: npm run seed:organizations');
      return;
    }

    console.log(`Found ${orgs.length} organizations:`);
    orgs.forEach(org => console.log(`  - ${org.displayName} (${org.url})`));

    // Initialize vector store
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: 'document_chunks',
      queryName: 'match_documents',
    });

    // Test query
    const testQuery = "sales strategy";
    console.log(`\n🔍 Testing query: "${testQuery}"\n`);

    // Test each organization
    for (const org of orgs) {
      console.log(`📋 Testing ${org.displayName} (${org.url}):`);

      const retriever = vectorStore.asRetriever({
        k: 3,
        searchType: "similarity",
        filter: { orgUrl: org.url }, // Using the correct filter format
      });

      const docs = await retriever.invoke(testQuery);
      console.log(`  📄 Found ${docs.length} documents`);

      if (docs.length > 0) {
        console.log(`  ✅ Organization filtering working for ${org.url}`);
        docs.forEach((doc, i) => {
          const orgFromDoc = doc.metadata?.orgUrl;
          const source = doc.metadata?.source;
          const isCorrectOrg = orgFromDoc === org.url;
          
          console.log(`    Doc ${i + 1}: ${source} (org: ${orgFromDoc}) ${isCorrectOrg ? '✅' : '❌'}`);
        });
      } else {
        console.log(`  ⚠️  No documents found for ${org.url} - may not have uploaded documents`);
      }
      console.log('');
    }

    // Test without filter (should return all documents)
    console.log('🌐 Testing without organization filter:');
    const allRetriever = vectorStore.asRetriever({
      k: 5,
      searchType: "similarity",
    });

    const allDocs = await allRetriever.invoke(testQuery);
    console.log(`  📄 Found ${allDocs.length} total documents`);
    
    const orgCounts: Record<string, number> = {};
    allDocs.forEach(doc => {
      const orgUrl = doc.metadata?.orgUrl;
      if (orgUrl) {
        orgCounts[orgUrl] = (orgCounts[orgUrl] || 0) + 1;
      }
    });

    console.log('  📊 Documents by organization:');
    Object.entries(orgCounts).forEach(([orgUrl, count]) => {
      const orgName = orgs.find(o => o.url === orgUrl)?.displayName || orgUrl;
      console.log(`    ${orgName}: ${count} documents`);
    });

    console.log('\n✅ RAG organization filtering test completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Upload documents to different organizations via /[orgUrl]/manage/knowledge');
    console.log('   2. Test chat functionality at /[orgUrl]/chat');
    console.log('   3. Verify each organization only sees their own documents');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testOrgSpecificRAG();
} 