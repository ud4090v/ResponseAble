// test-refactored-calls-2-3.js
// Test refactored API calls #2 and #3: classify-email-type and determine-goals-generic

const BASE_URL = 'https://xrepl.app/api';

// Test data
const testEmailContent = "Hi there,\n\nI'm interested in learning more about your product. Could you send me some information about pricing and features?\n\nThanks,\nJohn";

const testPackages = [
  {
    name: 'generic',
    description: 'Generic professional email responses',
    intent: 'General inquiry or follow-up',
    userIntent: 'Respond professionally to any email',
    roleDescription: 'Professional email responder',
    contextSpecific: 'Use for any general professional communication',
    base: true
  },
  {
    name: 'sales',
    description: 'Sales outreach and follow-up emails',
    intent: 'Sales and business development',
    userIntent: 'Generate sales emails and follow-ups',
    roleDescription: 'Sales professional',
    contextSpecific: 'Use for sales outreach, follow-ups, and business development',
    base: false
  }
];

// Test Call #2: classify-email-type
async function testCall2_Old(iterations = 3) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing Call #2 OLD: classify-email-type');
  console.log('(Extension constructs prompt → /api/generate)');
  console.log('='.repeat(60));

  // Simulate old implementation
  const getCompactPackageInfo = (pkg) => {
    return `${pkg.name}: ${pkg.description}`;
  };

  const typesWithContext = testPackages.map(p => getCompactPackageInfo(p)).join('\n');
  const typeDeterminationPrompt = `Available packages:
${typesWithContext}

Classify the email into one of the packages above. Return JSON:
{"matched_type":{"name":"package_name","description":"...","intent":"...","roleDescription":"...","contextSpecific":"..."},"confidence":0.0-1.0,"reason":"brief explanation"}

Rules: Only use packages listed. If unclear, use base package. Focus on the specific email content, not thread history.`;

  const messages = [
    {
      role: 'system',
      content: typeDeterminationPrompt
    },
    {
      role: 'user',
      content: `=== EMAIL BEING REPLIED TO ===
${testEmailContent}

Recipient: John Doe (Acme Corp)
Subject: Re: Product Inquiry`
    }
  ];

  const timings = [];
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      const response = await fetch(`${BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.3,
          max_tokens: 1200
        })
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);

      if (response.ok) {
        const data = await response.json();
        let typeContent = data.choices?.[0]?.message?.content || '{}';
        typeContent = typeContent.trim();
        if (typeContent.startsWith('```json')) {
          typeContent = typeContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (typeContent.startsWith('```')) {
          typeContent = typeContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const result = JSON.parse(typeContent);
        
        successCount++;
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ✅`);
        console.log(`    → Matched: ${result.matched_type?.name || 'N/A'}, Confidence: ${result.confidence || 'N/A'}`);
      } else {
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Status: ${response.status})`);
      }
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);
      console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Error: ${error.message})`);
    }

    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const median = timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)];

  return { avg, median, min, max, range: max - min, successCount, timings };
}

async function testCall2_New(iterations = 3) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing Call #2 NEW: classify-email-type');
  console.log('(Extension sends context → /api/classify-email-type)');
  console.log('='.repeat(60));

  const timings = [];
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      const response = await fetch(`${BASE_URL}/classify-email-type`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailContent: testEmailContent,
          recipientName: 'John Doe',
          recipientCompany: 'Acme Corp',
          subject: 'Re: Product Inquiry',
          availablePackages: testPackages,
          confidenceThreshold: 0.85,
          provider: 'openai',
          model: 'gpt-4o-mini'
        })
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);

      if (response.ok) {
        const result = await response.json();
        successCount++;
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ✅`);
        console.log(`    → Matched: ${result.matched_type?.name || 'N/A'}, Confidence: ${result.confidence || 'N/A'}`);
      } else {
        const error = await response.json();
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Status: ${response.status})`);
      }
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);
      console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Error: ${error.message})`);
    }

    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const median = timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)];

  return { avg, median, min, max, range: max - min, successCount, timings };
}

// Test Call #3: determine-goals-generic
async function testCall3_Old(iterations = 3) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing Call #3 OLD: determine-goals-generic');
  console.log('(Extension constructs prompt → /api/generate)');
  console.log('='.repeat(60));

  const genericIntent = 'General inquiry or follow-up';
  const genericGoalsPrompt = `You are an expert email classifier. The intent has ALREADY been determined as a generic professional intent. Your task is to determine appropriate response goals that are contextually relevant to the email while staying within generic professional boundaries.

The generic intent is: "${genericIntent}"

CRITICAL: Do NOT analyze the email content to determine or infer any intent. The intent is already provided above as generic. However, you SHOULD use the email content to understand the context and determine contextually appropriate response goals.

Return a JSON object with:
{
  "response_goals": Array of up to 3 most appropriate goals for the recipient's reply, ranked by suitability. These goals should be contextually relevant to the email content while remaining generic professional responses. Prioritize positive, constructive, and engaging response goals (e.g., "Express interest", "Request more information", "Schedule a discussion") over negative or defensive ones (e.g., "Politely decline", "Reject the offer"). The first goal should be the most positive and constructive response option.
  "goal_titles": Object with keys matching response_goals, each containing a short title (2-4 words max) suitable for a tab label.
  "variant_sets": Object with keys matching response_goals, each containing array of exactly 4 specific variant labels ranked by relevance.
  "recipient_name": string (the name of the person who SENT this email - should be "John Doe"),
  "recipient_company": string or null (the company of the person who SENT this email),
  "key_topics": array of strings (max 5, based on the email content)
}

Email content (use this to understand context for determining appropriate goals):
${testEmailContent}

Sender: John Doe (Acme Corp)
Subject: Re: Product Inquiry

CRITICAL INSTRUCTIONS:
- The intent is ALREADY determined as: "${genericIntent}" - do NOT analyze the email to determine intent
- Use the email content to understand the context and determine contextually appropriate goals
- Prioritize positive, constructive response goals (express interest, request information, engage positively) as the first/recommended goal
- Goals should be generic professional responses but contextually relevant to what the sender is offering/asking
- Only use the email content to extract recipient_name, recipient_company, and key_topics
- Do NOT include an "intent" field in your JSON response - the intent is already determined
- Return ONLY valid JSON, no other text.`;

  const messages = [
    {
      role: 'system',
      content: genericGoalsPrompt
    }
  ];

  const timings = [];
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      const response = await fetch(`${BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);

      if (response.ok) {
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '{}';
        content = content.trim();
        if (content.startsWith('```json')) {
          content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (content.startsWith('```')) {
          content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const result = JSON.parse(content);
        
        successCount++;
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ✅`);
        console.log(`    → Intent: ${genericIntent}, Goals: ${result.response_goals?.length || 0}`);
      } else {
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Status: ${response.status})`);
      }
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);
      console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Error: ${error.message})`);
    }

    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const median = timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)];

  return { avg, median, min, max, range: max - min, successCount, timings };
}

async function testCall3_New(iterations = 3) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing Call #3 NEW: determine-goals-generic');
  console.log('(Extension sends context → /api/determine-goals-generic)');
  console.log('='.repeat(60));

  const timings = [];
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      const response = await fetch(`${BASE_URL}/determine-goals-generic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailContent: testEmailContent,
          genericIntent: 'General inquiry or follow-up',
          recipientName: 'John Doe',
          recipientCompany: 'Acme Corp',
          subject: 'Re: Product Inquiry',
          numGoals: 3,
          numVariants: 4,
          provider: 'openai',
          model: 'gpt-4o-mini'
        })
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);

      if (response.ok) {
        const result = await response.json();
        successCount++;
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ✅`);
        console.log(`    → Intent: ${result.intent || 'N/A'}, Goals: ${result.response_goals?.length || 0}`);
      } else {
        const error = await response.json();
        console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Status: ${response.status})`);
      }
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;
      timings.push(latency);
      console.log(`  Request ${i + 1}: ${latency.toFixed(2)}ms ❌ (Error: ${error.message})`);
    }

    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const median = timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)];

  return { avg, median, min, max, range: max - min, successCount, timings };
}

// Main test function
async function runTests() {
  console.log('='.repeat(60));
  console.log('REFACTORED API CALLS TEST: #2 and #3');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Iterations per test: 5`);

  // Test Call #2
  const call2_old = await testCall2_Old(5);
  await new Promise(resolve => setTimeout(resolve, 2000));
  const call2_new = await testCall2_New(5);

  // Wait between different calls
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test Call #3
  const call3_old = await testCall3_Old(5);
  await new Promise(resolve => setTimeout(resolve, 2000));
  const call3_new = await testCall3_New(5);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY RESULTS');
  console.log('='.repeat(60));

  console.log(`\nCall #2: classify-email-type`);
  console.log(`  OLD: ${call2_old.avg.toFixed(2)}ms avg (${call2_old.successCount}/5 success)`);
  console.log(`  NEW: ${call2_new.avg.toFixed(2)}ms avg (${call2_new.successCount}/5 success)`);
  const diff2 = call2_new.avg - call2_old.avg;
  const pct2 = (diff2 / call2_old.avg) * 100;
  console.log(`  Difference: ${diff2 > 0 ? '+' : ''}${diff2.toFixed(2)}ms (${pct2 > 0 ? '+' : ''}${pct2.toFixed(2)}%)`);

  console.log(`\nCall #3: determine-goals-generic`);
  console.log(`  OLD: ${call3_old.avg.toFixed(2)}ms avg (${call3_old.successCount}/5 success)`);
  console.log(`  NEW: ${call3_new.avg.toFixed(2)}ms avg (${call3_new.successCount}/5 success)`);
  const diff3 = call3_new.avg - call3_old.avg;
  const pct3 = (diff3 / call3_old.avg) * 100;
  console.log(`  Difference: ${diff3 > 0 ? '+' : ''}${diff3.toFixed(2)}ms (${pct3 > 0 ? '+' : ''}${pct3.toFixed(2)}%)`);

  return { call2_old, call2_new, call3_old, call3_new };
}

// Use performance.now() polyfill for Node.js
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

// Run tests
runTests().catch(console.error);
