import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function debugVectorSearch() {
  console.log('🔍 Starting Vector Search Debug...\n');

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
    // 1. Check if any document chunks exist
    console.log('1️⃣ Checking document_chunks table...');
    const { data: allChunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, metadata')
      .limit(5);

    if (chunksError) {
      console.error('❌ Error querying document_chunks:', chunksError);
      return;
    }

    console.log(`📊 Total chunks found: ${allChunks?.length || 0}`);
    if (allChunks && allChunks.length > 0) {
      console.log('📋 Sample metadata:');
      allChunks.forEach((chunk, i) => {
        console.log(`   Chunk ${i + 1}:`, chunk.metadata);
      });
    }

    // 2. Check organizations
    console.log('\n2️⃣ Checking organizations...');
    const { data: orgs, error: orgsError } = await supabase
      .from('orgs')
      .select('id, url, displayName');

    if (orgsError) {
      console.error('❌ Error querying orgs:', orgsError);
      return;
    }

    console.log(`🏢 Organizations found: ${orgs?.length || 0}`);
    orgs?.forEach(org => {
      console.log(`   - ${org.displayName} (${org.url})`);
    });

    if (!orgs || orgs.length === 0) {
      console.log('⚠️  No organizations found. Run: npm run seed:organizations');
      return;
    }

    // 3. Test vector search without filter
    console.log('\n3️⃣ Testing vector search without filter...');
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: 'document_chunks',
      queryName: 'match_documents',
    });

    const testQuery = "sales strategy";
    console.log(`🔍 Searching for: "${testQuery}"`);

    const unfiltered = vectorStore.asRetriever({
      k: 5,
      searchType: "similarity",
    });

    const unfilteredDocs = await unfiltered.invoke(testQuery);
    console.log(`📄 Documents found (no filter): ${unfilteredDocs.length}`);
    
    unfilteredDocs.forEach((doc, i) => {
      console.log(`   Doc ${i + 1} metadata:`, doc.metadata);
      console.log(`   Doc ${i + 1} content preview:`, doc.pageContent.substring(0, 100) + '...');
    });

    // 4. Test with organization filter
    if (orgs && orgs.length > 0) {
      const testOrgUrl = orgs[0].url;
      console.log(`\n4️⃣ Testing vector search with org filter (${testOrgUrl})...`);

      // Try different filter formats (prioritizing the working one)
      const filterFormats = [
        { "orgUrl": testOrgUrl },              // ✅ This format works
        { "metadata->>orgUrl": testOrgUrl },   // ❌ JSON path format doesn't work
        { "metadata": { "orgUrl": testOrgUrl } } // ❌ Nested format doesn't work
      ];

      for (let i = 0; i < filterFormats.length; i++) {
        const filterFormat = filterFormats[i];
        console.log(`\n   Testing filter format ${i + 1}:`, filterFormat);

        try {
          const filtered = vectorStore.asRetriever({
            k: 5,
            searchType: "similarity",
            filter: filterFormat,
          });

          const filteredDocs = await filtered.invoke(testQuery);
          console.log(`   📄 Documents found: ${filteredDocs.length}`);
          
          if (filteredDocs.length > 0) {
            console.log(`   ✅ Filter format works!`);
            filteredDocs.forEach((doc, j) => {
              console.log(`      Doc ${j + 1} metadata:`, doc.metadata);
            });
          } else {
            console.log(`   ❌ No documents found with this filter`);
          }
        } catch (error) {
          console.log(`   ❌ Error with filter format:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    // 5. Check documents table
    console.log('\n5️⃣ Checking documents table...');
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, filename, org_id, status')
      .limit(5);

    if (docsError) {
      console.error('❌ Error querying documents:', docsError);
      return;
    }

    console.log(`📁 Documents found: ${docs?.length || 0}`);
    docs?.forEach(doc => {
      console.log(`   - ${doc.filename} (org_id: ${doc.org_id}, status: ${doc.status})`);
    });

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

if (require.main === module) {
  debugVectorSearch();
} 