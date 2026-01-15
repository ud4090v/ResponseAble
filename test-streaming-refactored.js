// test-streaming-refactored.js
// Test refactored streaming endpoints (#10, #11)

const BASE_URL = 'https://xrepl.app/api';

// Test data
const testData = {
  generateDraftsReply: {
    emailContent: "Hi,\n\nI'm interested in your product. Can you tell me more?\n\nThanks,\nJohn",
    threadHistory: "",
    package: {
      name: 'sales',
      roleDescription: 'Sales professional',
      contextSpecific: 'Use for sales outreach, follow-ups, and business development'
    },
    variantSet: ['Friendly', 'Professional', 'Value-focused', 'Concise'],
    currentGoal: 'Provide information',
    goalTone: 'Professional',
    recipientName: 'John Doe',
    recipientCompany: 'Acme Corp',
    subject: 'Re: Product Inquiry',
    senderName: 'John Doe',
    intent: 'Request for product information',
    keyTopics: ['pricing', 'product features'],
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 2000
  },
  generateDraftsDraft: {
    typedContent: "I wanted to reach out about our new product offering.",
    package: {
      name: 'sales',
      userIntent: 'Generate sales emails and follow-ups',
      roleDescription: 'Sales professional',
      contextSpecific: 'Use for sales outreach, follow-ups, and business development'
    },
    variantSet: ['Direct', 'Value-first', 'Relationship-based', 'Question-led'],
    currentGoal: 'Introduce product',
    goalTone: 'Professional',
    recipientName: 'John Doe',
    recipientCompany: 'Acme Corp',
    userIntent: 'Generate sales emails and follow-ups',
    keyTopics: ['product introduction', 'business value'],
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 2000
  }
};

/**
 * Test streaming endpoint
 */
async function testStreamingEndpoint(name, url, data) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Streaming Endpoint: ${name}`);
  console.log(`Endpoint: ${url}`);
  console.log('='.repeat(60));

  const startTime = performance.now();
  let firstTokenTime = null;
  let lastTokenTime = null;
  let totalChunks = 0;
  let totalContent = '';
  let variants = [];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`❌ Request failed: ${response.status}`);
      console.log(`Error: ${error}`);
      return { success: false };
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      // Record first token time
      if (firstTokenTime === null) {
        firstTokenTime = performance.now();
        console.log(`⏱️  Time to first token: ${(firstTokenTime - startTime).toFixed(2)}ms`);
      }

      lastTokenTime = performance.now();
      totalChunks++;

      // Decode chunk
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              totalContent += content;
            }
          } catch (e) {
            // Ignore malformed JSON
          }
        } else if (line.trim() && !line.startsWith('data:')) {
          // Handle direct content
          totalContent += line.trim();
        }
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const streamingDuration = lastTokenTime - firstTokenTime;
    const avgChunkRate = totalChunks / (streamingDuration / 1000);

    // Count variants
    variants = totalContent.split('|||RESPONSE_VARIANT|||').filter(v => v.trim().length > 0);

    console.log(`\n✅ Streaming completed successfully!`);
    console.log(`\n📊 Streaming Metrics:`);
    console.log(`  Time to first token: ${(firstTokenTime - startTime).toFixed(2)}ms`);
    console.log(`  Total streaming duration: ${streamingDuration.toFixed(2)}ms`);
    console.log(`  Total request time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Total chunks received: ${totalChunks}`);
    console.log(`  Average chunk rate: ${avgChunkRate.toFixed(2)} chunks/sec`);
    console.log(`  Total content length: ${totalContent.length} characters`);
    console.log(`  Draft variants generated: ${variants.length}`);
    console.log(`\n💡 User-perceived latency: ${(firstTokenTime - startTime).toFixed(2)}ms`);

    return {
      success: true,
      timeToFirstToken: firstTokenTime - startTime,
      totalTime,
      streamingDuration,
      totalChunks,
      contentLength: totalContent.length,
      variantsCount: variants.length
    };

  } catch (error) {
    const endTime = performance.now();
    console.log(`❌ Test error: ${error.message}`);
    console.log(`   Total time: ${(endTime - startTime).toFixed(2)}ms`);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runStreamingTests() {
  console.log('='.repeat(60));
  console.log('STREAMING ENDPOINTS TEST (Refactored Calls #10, #11)');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);

  // Test endpoint #10: generate-drafts-reply
  const result10 = await testStreamingEndpoint(
    'generate-drafts-reply',
    `${BASE_URL}/generate-drafts-reply`,
    testData.generateDraftsReply
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test endpoint #11: generate-drafts-draft
  const result11 = await testStreamingEndpoint(
    'generate-drafts-draft',
    `${BASE_URL}/generate-drafts-draft`,
    testData.generateDraftsDraft
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log('STREAMING TESTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nCall #10: generate-drafts-reply`);
  if (result10.success) {
    console.log(`  Time to first token: ${result10.timeToFirstToken.toFixed(2)}ms`);
    console.log(`  Total time: ${result10.totalTime.toFixed(2)}ms`);
    console.log(`  Variants: ${result10.variantsCount}`);
  } else {
    console.log(`  ❌ Failed: ${result10.error}`);
  }

  console.log(`\nCall #11: generate-drafts-draft`);
  if (result11.success) {
    console.log(`  Time to first token: ${result11.timeToFirstToken.toFixed(2)}ms`);
    console.log(`  Total time: ${result11.totalTime.toFixed(2)}ms`);
    console.log(`  Variants: ${result11.variantsCount}`);
  } else {
    console.log(`  ❌ Failed: ${result11.error}`);
  }

  console.log(`\n${'='.repeat(60)}`);
}

// Use performance.now() polyfill for Node.js
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

// Run tests
runStreamingTests().catch(console.error);
