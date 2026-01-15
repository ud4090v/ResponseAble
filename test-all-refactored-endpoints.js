// test-all-refactored-endpoints.js
// Comprehensive test script for all refactored API endpoints (4-11 + LinkedIn)

const BASE_URL = 'https://xrepl.app/api';

// Test data
const testData = {
  // Call #4: determine-goals-reply
  determineGoalsReply: {
    emailContent: "Hi,\n\nI'm interested in your product. Can you tell me more about pricing?\n\nThanks,\nJohn",
    package: {
      name: 'sales',
      roleDescription: 'Sales professional',
      contextSpecific: 'Use for sales outreach, follow-ups, and business development'
    },
    recipientName: 'John Doe',
    recipientCompany: 'Acme Corp',
    subject: 'Re: Product Inquiry',
    numGoals: 3,
    numVariants: 4,
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  // Call #5: determine-tones-reply
  determineTonesReply: {
    emailContent: "Hi,\n\nThanks for your email. I'd be happy to discuss.\n\nBest,\nJohn",
    threadHistory: "Previous conversation about the project...",
    intent: 'Request for discussion',
    responseGoals: ['Express interest', 'Schedule a meeting', 'Provide information'],
    numTones: 3,
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  // Call #6: classify-draft-type
  classifyDraftType: {
    typedContent: "I'm reaching out about a potential partnership opportunity.",
    subject: 'Partnership Opportunity',
    recipient: 'partner@example.com',
    availablePackages: [
      {
        name: 'generic',
        description: 'Generic professional email responses',
        base: true
      },
      {
        name: 'sales',
        description: 'Sales outreach and follow-up emails',
        base: false
      }
    ],
    confidenceThreshold: 0.85,
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  // Call #7: determine-tones-draft-generic
  determineTonesDraftGeneric: {
    typedContent: "I wanted to reach out about a potential collaboration.",
    subject: 'Collaboration Opportunity',
    recipient: 'partner@example.com',
    numTones: 3,
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  // Call #8: determine-goals-draft
  determineGoalsDraft: {
    typedContent: "I wanted to reach out about our new product offering.",
    package: {
      name: 'sales',
      userIntent: 'Generate sales emails and follow-ups',
      roleDescription: 'Sales professional',
      contextSpecific: 'Use for sales outreach, follow-ups, and business development'
    },
    recipientName: 'John Doe',
    recipientCompany: 'Acme Corp',
    platform: 'gmail',
    numGoals: 5,
    numVariants: 4,
    provider: 'openai',
    model: 'gpt-4o-mini'
  },
  // Call #9: determine-tones-draft-specific
  determineTonesDraftSpecific: {
    userIntent: 'Generate sales emails and follow-ups',
    responseGoals: ['Introduce product', 'Build rapport', 'Schedule demo'],
    numTones: 3,
    provider: 'openai',
    model: 'gpt-4o-mini'
  }
};

// Test configuration
const TEST_CONFIG = {
  iterations: 3,
  delayBetweenRequests: 1000,
  delayBetweenEndpoints: 2000
};

// Results storage
const results = {};

/**
 * Test a single endpoint
 */
async function testEndpoint(name, url, data, iterations = TEST_CONFIG.iterations) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`Endpoint: ${url}`);
  console.log('='.repeat(60));

  const timings = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);

      if (response.ok) {
        const result = await response.json();
        successCount++;
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ✅`);
        
        // Log key response fields
        if (result.matched_type) {
          console.log(`    → Matched: ${result.matched_type.name || 'N/A'}, Confidence: ${result.confidence || 'N/A'}`);
        } else if (result.intent) {
          console.log(`    → Intent: ${result.intent}, Goals: ${result.response_goals?.length || 0}`);
        } else if (result.tone_needed) {
          console.log(`    → Tone: ${result.tone_needed}, Sets: ${Object.keys(result.tone_sets || {}).length}`);
        } else if (result.response_goals) {
          console.log(`    → Goals: ${result.response_goals.length}`);
        }
      } else {
        const error = await response.json();
        errorCount++;
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Status: ${response.status})`);
        console.log(`    Error: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);
      errorCount++;
      console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Error: ${error.message})`);
    }

    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenRequests));
    }
  }

  // Calculate statistics
  const avg = timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
  const min = timings.length > 0 ? Math.min(...timings) : 0;
  const max = timings.length > 0 ? Math.max(...timings) : 0;
  const sorted = [...timings].sort((a, b) => a - b);
  const median = timings.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  const result = {
    name,
    url,
    avg,
    median,
    min,
    max,
    range: max - min,
    successCount,
    errorCount,
    successRate: (successCount / iterations) * 100,
    timings
  };

  console.log(`\n  Statistics:`);
  console.log(`    Average: ${avg.toFixed(2)}ms`);
  console.log(`    Median:  ${median.toFixed(2)}ms`);
  console.log(`    Min:     ${min.toFixed(2)}ms`);
  console.log(`    Max:     ${max.toFixed(2)}ms`);
  console.log(`    Range:   ${(max - min).toFixed(2)}ms`);
  console.log(`    Success: ${successCount}/${iterations} (${result.successRate.toFixed(1)}%)`);

  return result;
}

/**
 * Main test function
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE API ENDPOINT TESTING (Refactored Calls #4-9)');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Iterations per endpoint: ${TEST_CONFIG.iterations}`);

  const endpoints = [
    { name: 'determine-goals-reply', url: `${BASE_URL}/determine-goals-reply`, data: testData.determineGoalsReply },
    { name: 'determine-tones-reply', url: `${BASE_URL}/determine-tones-reply`, data: testData.determineTonesReply },
    { name: 'classify-draft-type', url: `${BASE_URL}/classify-draft-type`, data: testData.classifyDraftType },
    { name: 'determine-tones-draft-generic', url: `${BASE_URL}/determine-tones-draft-generic`, data: testData.determineTonesDraftGeneric },
    { name: 'determine-goals-draft', url: `${BASE_URL}/determine-goals-draft`, data: testData.determineGoalsDraft },
    { name: 'determine-tones-draft-specific', url: `${BASE_URL}/determine-tones-draft-specific`, data: testData.determineTonesDraftSpecific }
  ];

  // Test non-streaming endpoints
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.name, endpoint.url, endpoint.data);
    results[endpoint.name] = result;
    
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenEndpoints));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Note: Streaming endpoints (#10, #11) require specialized streaming handling');
  console.log('      and are tested separately.');
  console.log('='.repeat(60));

  // Print summary
  printSummary();
}

/**
 * Print test summary
 */
function printSummary() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const allResults = Object.values(results);
  const totalAvg = allResults.reduce((sum, r) => sum + r.avg, 0) / allResults.length;
  const totalSuccess = allResults.reduce((sum, r) => sum + r.successCount, 0);
  const totalErrors = allResults.reduce((sum, r) => sum + r.errorCount, 0);
  const totalRequests = totalSuccess + totalErrors;

  console.log(`\nOverall Statistics:`);
  console.log(`  Total Endpoints Tested: ${allResults.length}`);
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  Successful: ${totalSuccess} (${(totalSuccess / totalRequests * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${totalErrors} (${(totalErrors / totalRequests * 100).toFixed(1)}%)`);
  console.log(`  Average Latency (all endpoints): ${totalAvg.toFixed(2)}ms`);

  console.log(`\nEndpoint Performance (sorted by average latency):`);
  const sorted = [...allResults].sort((a, b) => a.avg - b.avg);
  sorted.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name.padEnd(35)} ${r.avg.toFixed(2).padStart(8)}ms (${r.successRate.toFixed(1)}% success)`);
  });

  console.log(`\n${'='.repeat(60)}`);
}

// Use performance.now() polyfill for Node.js
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

// Run tests
runAllTests().catch(console.error);
