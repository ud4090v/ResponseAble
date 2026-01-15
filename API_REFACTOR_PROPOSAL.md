# API Refactoring Proposal

## 1. Proposed API Definition

### API Base Structure
- **Base URL:** `https://xrepl.app/api`
- **Authentication:** None (API keys managed server-side)
- **Content-Type:** `application/json`
- **Response Format:** JSON (except streaming endpoints)

---

### Endpoint 1: Analyze User Style
**POST** `/api/analyze-style`

**Purpose:** Analyze user's writing style from previous emails

**Request Body:**
```json
{
  "userEmails": ["email1 text", "email2 text", ...],  // Array of up to 10 email texts
  "provider": "openai" | "grok",                      // Optional, defaults to "openai"
  "model": "gpt-4o-mini" | "grok-4-fast"               // Optional, defaults based on provider
}
```

**Response:**
```json
{
  "formality": "professional",
  "sentence_length": "medium",
  "word_choice": "moderate",
  "punctuation_style": "standard",
  "greeting_patterns": ["Hi", "Hello"],
  "closing_patterns": ["Best regards", "Thanks"],
  "usesEmojis": false,
  "usesExclamations": true,
  "startsWithGreeting": true,
  "endsWithSignOff": true,
  "sample_count": 10
}
```

---

### Endpoint 2: Classify Email Type (Reply)
**POST** `/api/classify-email-type`

**Purpose:** Determine which package/type matches an email being replied to

**Request Body:**
```json
{
  "emailContent": "Full email text being replied to",
  "recipientName": "John Doe",                        // Optional
  "recipientCompany": "Acme Corp",                    // Optional
  "subject": "Re: Meeting",                          // Optional
  "availablePackages": [                              // Array of package objects
    {
      "name": "sales",
      "description": "...",
      "intent": "...",
      "userIntent": "...",
      "roleDescription": "...",
      "contextSpecific": "...",
      "base": false
    },
    ...
  ],
  "confidenceThreshold": 0.85,                        // Optional, defaults to 0.85
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"              // Optional
}
```

**Response:**
```json
{
  "matched_type": {
    "name": "sales",
    "description": "...",
    "intent": "...",
    "userIntent": "...",
    "roleDescription": "...",
    "contextSpecific": "...",
    "base": false
  },
  "confidence": 0.92,
  "reason": "Email contains sales-related content"
}
```

---

### Endpoint 3: Classify Email Type (New Draft)
**POST** `/api/classify-draft-type`

**Purpose:** Determine which package/type matches a new email being drafted

**Request Body:**
```json
{
  "typedContent": "User's typed email content",
  "subject": "Meeting Request",                       // Optional
  "recipient": "john@example.com",                   // Optional
  "availablePackages": [                              // Array of package objects
    {
      "name": "sales",
      "description": "...",
      "userIntent": "...",
      "roleDescription": "...",
      "contextSpecific": "..."
    },
    ...
  ],
  "confidenceThreshold": 0.85,                        // Optional
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"             // Optional
}
```

**Response:**
```json
{
  "matched_type": {
    "name": "sales",
    "description": "...",
    "userIntent": "...",
    "roleDescription": "...",
    "contextSpecific": "..."
  },
  "confidence": 0.88,
  "reason": "User is drafting a sales outreach email"
}
```

---

### Endpoint 4: Determine Goals (Generic Package)
**POST** `/api/determine-goals-generic`

**Purpose:** Generate generic response goals when using base/generic package

**Request Body:**
```json
{
  "emailContent": "Email being replied to",
  "genericIntent": "General inquiry or follow-up",    // Pre-determined generic intent
  "recipientName": "John Doe",                        // Optional
  "recipientCompany": "Acme Corp",                    // Optional
  "subject": "Re: Question",                          // Optional
  "numGoals": 3,                                       // Optional, defaults to 3
  "numVariants": 4,                                   // Optional, defaults to 4
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"              // Optional
}
```

**Response:**
```json
{
  "intent": "General inquiry or follow-up",
  "response_goals": [
    "Express interest",
    "Request more information",
    "Schedule a discussion"
  ],
  "goal_titles": {
    "Express interest": "Interest",
    "Request more information": "Information"
  },
  "variant_sets": {},
  "recipient_name": "John Doe",
  "recipient_company": "Acme Corp",
  "key_topics": ["product demo", "pricing"]
}
```

---

### Endpoint 5: Determine Goals (Specific Package - Reply)
**POST** `/api/determine-goals-reply`

**Purpose:** Determine intent and goals when replying with a specific package

**Request Body:**
```json
{
  "emailContent": "Email being replied to",
  "package": {                                        // Matched package object
    "name": "sales",
    "description": "...",
    "intent": "...",
    "userIntent": "...",
    "roleDescription": "...",
    "contextSpecific": "..."
  },
  "recipientName": "John Doe",                        // Optional
  "recipientCompany": "Acme Corp",                     // Optional
  "subject": "Re: Product Demo",                      // Optional
  "numGoals": 3,                                       // Optional, defaults to 3
  "numVariants": 4,                                   // Optional, defaults to 4
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"              // Optional
}
```

**Response:**
```json
{
  "intent": "Customer is interested in product demo",
  "response_goals": [
    "Schedule demo",
    "Provide product info",
    "Qualify lead"
  ],
  "goal_titles": {
    "Schedule demo": "Demo",
    "Provide product info": "Information"
  },
  "variant_sets": {},
  "recipient_name": "John Doe",
  "recipient_company": "Acme Corp",
  "key_topics": ["demo", "pricing"]
}
```

---

### Endpoint 6: Determine Goals (New Draft - Specific Package)
**POST** `/api/determine-goals-draft`

**Purpose:** Determine goals for a new email draft with specific package

**Request Body:**
```json
{
  "typedContent": "User's typed email content",       // Optional
  "package": {                                        // Matched package object
    "name": "sales",
    "userIntent": "...",
    "roleDescription": "...",
    "contextSpecific": "..."
  },
  "recipientName": "John Doe",                        // Optional
  "recipientCompany": "Acme Corp",                    // Optional
  "platform": "gmail" | "linkedin",                  // Optional, defaults to "gmail"
  "numGoals": 5,                                       // Optional, defaults to 5
  "numVariants": 4,                                   // Optional, defaults to 4
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"             // Optional
}
```

**Response:**
```json
{
  "response_goals": [
    "Introduce yourself",
    "Build rapport",
    "Make a request"
  ],
  "goal_titles": {
    "Introduce yourself": "Introduction",
    "Build rapport": "Rapport"
  },
  "variant_sets": {
    "Introduce yourself": ["Professional", "Warm", "Concise"],
    "Build rapport": ["Friendly", "Professional", "Casual"]
  },
  "recipient_name": "John Doe",
  "recipient_company": "Acme Corp",
  "key_topics": ["product", "demo"]
}
```

---

### Endpoint 7: Determine Tones (Reply)
**POST** `/api/determine-tones-reply`

**Purpose:** Determine tone options for replying based on thread history

**Request Body:**
```json
{
  "emailContent": "Email being replied to",
  "threadHistory": "Previous conversation history",    // Optional
  "intent": "Customer is interested in product demo",
  "responseGoals": [                                  // Array of goal strings
    "Schedule demo",
    "Provide product info"
  ],
  "numTones": 3,                                      // Optional, defaults to 3
  "provider": "openai" | "grok",                     // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"             // Optional
}
```

**Response:**
```json
{
  "tone_needed": "Professional",
  "tone_sets": {
    "Schedule demo": ["Professional", "Friendly", "Enthusiastic"],
    "Provide product info": ["Informative", "Professional", "Helpful"]
  }
}
```

---

### Endpoint 8: Determine Tones (New Draft - Generic)
**POST** `/api/determine-tones-draft-generic`

**Purpose:** Determine tone options for new draft with generic package

**Request Body:**
```json
{
  "typedContent": "User's typed email content",
  "subject": "Meeting Request",                       // Optional
  "recipient": "john@example.com",                   // Optional
  "numTones": 3,                                     // Optional, defaults to 3
  "provider": "openai" | "grok",                     // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"             // Optional
}
```

**Response:**
```json
{
  "tone_needed": "Professional",
  "tone_sets": {
    "Generate appropriate draft": ["Professional", "Friendly", "Concise"]
  }
}
```

---

### Endpoint 9: Determine Tones (New Draft - Specific Package)
**POST** `/api/determine-tones-draft-specific`

**Purpose:** Determine tone options for new draft with specific package

**Request Body:**
```json
{
  "userIntent": "Reach out to potential customers",
  "responseGoals": [                                 // Array of goal strings
    "Introduce yourself",
    "Build rapport"
  ],
  "numTones": 3,                                     // Optional, defaults to 3
  "provider": "openai" | "grok",                     // Optional
  "model": "gpt-4o-mini" | "grok-4-fast"             // Optional
}
```

**Response:**
```json
{
  "tone_needed": "Professional",
  "tone_sets": {
    "Introduce yourself": ["Professional", "Warm"],
    "Build rapport": ["Friendly", "Casual"]
  }
}
```

---

### Endpoint 10: Generate Drafts (Reply) - STREAMING
**POST** `/api/generate-drafts-reply`

**Purpose:** Generate email draft variants for replying (streaming response)

**Request Body:**
```json
{
  "emailContent": "Email being replied to",
  "threadHistory": "Previous conversation history",   // Optional
  "package": {                                        // Matched package object
    "name": "sales",
    "roleDescription": "...",
    "contextSpecific": "..."
  },
  "intent": "Customer is interested in product demo",
  "responseGoals": ["Schedule demo", "Provide product info"],
  "toneSets": {                                       // Object with goal -> tones mapping
    "Schedule demo": ["Professional", "Friendly"],
    "Provide product info": ["Informative", "Professional"]
  },
  "variantStrategies": {                              // Optional, goal -> variant labels
    "Schedule demo": ["Direct", "Value-first"],
    "Provide product info": ["Detailed", "Concise"]
  },
  "recipientName": "John Doe",                        // Optional
  "recipientCompany": "Acme Corp",                    // Optional
  "subject": "Re: Product Demo",                      // Optional
  "senderName": "John Doe",                           // Optional (person who sent the email)
  "userStyleProfile": {                               // Optional (if style mimicking enabled)
    "formality": "professional",
    "sentence_length": "medium",
    "greeting_patterns": ["Hi", "Hello"],
    "closing_patterns": ["Best regards"],
    ...
  },
  "userAccountName": "Jane Smith",                   // Optional
  "platform": "gmail" | "linkedin",                  // Optional, defaults to "gmail"
  "numVariants": 4,                                   // Optional, defaults to 4
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o" | "grok-4-latest"                 // Optional (generation model, not classification)
}
```

**Response:** Streaming SSE (Server-Sent Events)
```
data: {"content": "Hi John"}\n\n
data: {"content": ","}\n\n
data: {"content": "\n\nThanks"}\n\n
...
data: [DONE]\n\n
```

**Note:** Extension will parse streaming chunks and accumulate full draft text.

---

### Endpoint 11: Generate Drafts (New Draft) - STREAMING
**POST** `/api/generate-drafts-draft`

**Purpose:** Generate email draft variants for new email (streaming response)

**Request Body:**
```json
{
  "typedContent": "User's typed email content",       // Optional
  "package": {                                        // Matched package object (or generic)
    "name": "sales",
    "roleDescription": "...",
    "contextSpecific": "..."
  },
  "responseGoals": ["Introduce yourself", "Build rapport"],
  "toneSets": {
    "Introduce yourself": ["Professional", "Warm"],
    "Build rapport": ["Friendly", "Casual"]
  },
  "variantStrategies": {                              // Optional
    "Introduce yourself": ["Direct", "Value-focused"],
    "Build rapport": ["Personal", "Engaging"]
  },
  "recipientName": "John Doe",                        // Optional
  "recipientCompany": "Acme Corp",                    // Optional
  "subject": "Meeting Request",                       // Optional
  "userAccountName": "Jane Smith",                   // Optional
  "platform": "gmail" | "linkedin",                  // Optional, defaults to "gmail"
  "numVariants": 4,                                   // Optional, defaults to 4
  "provider": "openai" | "grok",                      // Optional
  "model": "gpt-4o" | "grok-4-latest"                 // Optional
}
```

**Response:** Streaming SSE (Server-Sent Events)
```
data: {"content": "Hi John"}\n\n
data: {"content": ","}\n\n
...
data: [DONE]\n\n
```

---

## 2. Detailed Implementation Development Plan

### Phase 1: Setup & Infrastructure (Week 1)

#### 1.1 Create API Directory Structure
```
responsable-api/
├── api/
│   ├── analyze-style.js
│   ├── classify-email-type.js
│   ├── classify-draft-type.js
│   ├── determine-goals-generic.js
│   ├── determine-goals-reply.js
│   ├── determine-goals-draft.js
│   ├── determine-tones-reply.js
│   ├── determine-tones-draft-generic.js
│   ├── determine-tones-draft-specific.js
│   ├── generate-drafts-reply.js
│   ├── generate-drafts-draft.js
│   └── utils/
│       ├── prompts.js          // All prompt templates
│       ├── llm-client.js       // Shared LLM client logic
│       └── streaming.js        // Streaming response helpers
├── config/
│   └── packages.json           // Copy from extension (or fetch from shared source)
└── package.json
```

#### 1.2 Create Shared Utilities
- **`utils/llm-client.js`**: 
  - Provider configuration (OpenAI, Grok)
  - Unified API call function
  - Error handling
  - Model selection logic

- **`utils/prompts.js`**:
  - All prompt templates as functions
  - Parameterized prompt builders
  - Prompt versioning (for future updates)

- **`utils/streaming.js`**:
  - SSE response helpers
  - Chunk formatting
  - Error handling in streams

#### 1.3 Update Vercel Configuration
- Update `vercel.json` to handle all new endpoints
- Configure CORS for all endpoints
- Set up environment variables

---

### Phase 2: Implement Classification Endpoints (Week 1-2)

#### 2.1 Implement `/api/analyze-style`
- Extract prompt from extension code (lines 520-537)
- Create prompt builder function
- Implement LLM call with error handling
- Parse and validate JSON response
- Return structured style profile

#### 2.2 Implement `/api/classify-email-type`
- Extract prompt from extension code (lines 657-663)
- Handle package list formatting
- Implement classification logic
- Apply confidence threshold
- Return matched package with confidence

#### 2.3 Implement `/api/classify-draft-type`
- Extract prompt from extension code (lines 2980-3008)
- Similar to email type but for new drafts
- Handle typed content only (no forwarded messages)

---

### Phase 3: Implement Goals & Tones Endpoints (Week 2)

#### 3.1 Implement Goals Endpoints
- `/api/determine-goals-generic` (lines 764-792)
- `/api/determine-goals-reply` (lines 906-918)
- `/api/determine-goals-draft` (lines 3631-3654)

#### 3.2 Implement Tones Endpoints
- `/api/determine-tones-reply` (lines 969-985)
- `/api/determine-tones-draft-generic` (lines 3464-3475)
- `/api/determine-tones-draft-specific` (lines 3757-3768)

**Common Implementation Steps:**
1. Extract prompt templates
2. Create parameterized prompt builders
3. Implement LLM calls
4. Parse and validate JSON responses
5. Handle edge cases and fallbacks

---

### Phase 4: Implement Draft Generation Endpoints (Week 2-3)

#### 4.1 Implement `/api/generate-drafts-reply`
- Extract system prompt construction (lines 3100-3362)
- Extract user content construction (lines 4258-4293)
- Implement streaming response
- Handle style profile injection
- Handle package-specific context

#### 4.2 Implement `/api/generate-drafts-draft`
- Extract system prompt for new drafts (lines 3289-3362)
- Extract user content for new drafts (lines 4261-4273)
- Implement streaming response
- Handle generic vs specific package flows

**Key Considerations:**
- Streaming must be reliable
- Error handling in streams
- Chunk formatting consistency
- Timeout handling

---

### Phase 5: Extension Code Refactoring (Week 3-4)

#### 5.1 Create New API Client Functions
Replace `callProxyAPI` and `callProxyAPIStream` with:
- `analyzeUserStyle(userEmails, provider, model)`
- `classifyEmailType(emailContent, packages, ...)`
- `classifyDraftType(typedContent, packages, ...)`
- `determineGoalsGeneric(emailContent, intent, ...)`
- `determineGoalsReply(emailContent, package, ...)`
- `determineGoalsDraft(typedContent, package, ...)`
- `determineTonesReply(emailContent, threadHistory, goals, ...)`
- `determineTonesDraftGeneric(typedContent, ...)`
- `determineTonesDraftSpecific(intent, goals, ...)`
- `generateDraftsReply(context, ...)` - streaming
- `generateDraftsDraft(context, ...)` - streaming

#### 5.2 Update Function Calls
- Update `analyzeUserStyle()` to call new API
- Update `classifyEmail()` to call new APIs
- Update `generateDraftsWithTone()` to call new APIs
- Update `generateDraftsForNewEmail()` to call new APIs
- Update `generateGenericSingleDraft()` to call new APIs

#### 5.3 Remove Prompt Construction Code
- Delete all prompt construction logic
- Remove prompt templates from extension
- Clean up unused helper functions

#### 5.4 Update Error Handling
- Adapt error handling for new API responses
- Handle API-specific errors
- Maintain user-friendly error messages

---

### Phase 6: Testing & Validation (Week 4)

#### 6.1 Unit Testing
- Test each API endpoint independently
- Test prompt construction
- Test error handling
- Test streaming responses

#### 6.2 Integration Testing
- Test full flows (Reply, New Draft, Forward)
- Test with different packages
- Test with/without style mimicking
- Test streaming behavior

#### 6.3 Performance Testing
- Measure API response times
- Compare with current implementation
- Test under load
- Optimize if needed

#### 6.4 Edge Case Testing
- Empty inputs
- Missing optional parameters
- Invalid package data
- Network errors
- API provider errors

---

### Phase 7: Documentation & Deployment (Week 4-5)

#### 7.1 API Documentation
- Create OpenAPI/Swagger spec
- Document all endpoints
- Document request/response schemas
- Provide example requests/responses

#### 7.2 Extension Code Documentation
- Update inline comments
- Document new API client functions
- Update architecture docs

#### 7.3 Deployment
- Deploy API to Vercel
- Test production endpoints
- Update extension with production API URLs
- Monitor for issues

---

## 3. Performance Impact Analysis

### Current Architecture
```
Extension → Constructs Prompts → Vercel Proxy → OpenAI/Grok → Response → Extension
```

### New Architecture
```
Extension → Sends Context → Vercel API → Constructs Prompts → OpenAI/Grok → Response → Extension
```

### Performance Factors

#### ✅ **Improvements:**

1. **Reduced Extension Bundle Size**
   - **Current:** ~50-100KB of prompt templates in extension
   - **After:** ~5-10KB (just API client functions)
   - **Impact:** Faster extension load time, less memory usage

2. **Prompt Optimization in Backend**
   - Prompts can be optimized/updated without extension updates
   - Can A/B test prompt variations
   - Can cache optimized prompts
   - **Impact:** Potentially better AI responses, no user updates needed

3. **Centralized Error Handling**
   - Better error messages from backend
   - Consistent error handling
   - **Impact:** Better user experience

4. **Potential Caching**
   - Can cache package definitions
   - Can cache common prompt patterns
   - **Impact:** Faster response times for repeated operations

#### ⚠️ **Potential Concerns:**

1. **Additional Network Hop**
   - **Current:** Extension → Vercel → OpenAI/Grok
   - **After:** Extension → Vercel API → OpenAI/Grok (same)
   - **Impact:** **No change** - same number of hops

2. **Request Payload Size**
   - **Current:** Sends full prompt (large)
   - **After:** Sends context data (smaller, but structured)
   - **Impact:** **Slightly better** - structured data is more efficient

3. **Response Processing**
   - **Current:** Extension processes raw LLM responses
   - **After:** Backend processes, extension receives structured data
   - **Impact:** **Better** - less processing in extension

4. **Streaming Performance**
   - **Current:** Vercel proxies streaming directly
   - **After:** Vercel API processes chunks, then streams
   - **Impact:** **Minimal** - streaming still works, slight overhead from processing

#### 📊 **Overall Performance Estimate:**

| Metric | Current | After Refactor | Change |
|--------|---------|---------------|--------|
| Extension Bundle Size | ~100KB | ~10KB | **-90%** ✅ |
| Initial Load Time | Baseline | -5-10% | **Better** ✅ |
| API Response Time | Baseline | +0-50ms | **Slightly worse** ⚠️ |
| Streaming Latency | Baseline | +10-20ms | **Slightly worse** ⚠️ |
| Memory Usage | Baseline | -20-30% | **Better** ✅ |
| Network Payload | Large prompts | Smaller context | **Better** ✅ |
| Error Handling | Basic | Advanced | **Better** ✅ |
| Maintainability | Low | High | **Much better** ✅ |

### Detailed Analysis:

#### **API Response Time Impact:**
- **Prompt Construction:** ~5-10ms (moved from extension to backend)
- **Network:** Same (extension → Vercel → OpenAI)
- **Processing:** ~5-15ms (JSON parsing, validation in backend)
- **Total Additional Latency:** ~10-25ms per non-streaming call
- **For Streaming:** ~10-20ms initial latency, then same streaming speed

#### **Mitigation Strategies:**

1. **Optimize Prompt Construction**
   - Pre-compile prompt templates
   - Use string interpolation efficiently
   - Cache common prompt patterns

2. **Parallel API Calls**
   - Some calls can be made in parallel (e.g., goals + tones)
   - Backend can optimize call patterns

3. **Response Caching**
   - Cache classification results for similar emails
   - Cache style profiles (already done in extension)

4. **Streaming Optimization**
   - Minimize processing in streaming path
   - Use efficient chunk formatting
   - Keep streaming as direct as possible

### **Final Verdict:**

**Performance Impact: Slightly Negative for Latency, Positive Overall**

- **Latency:** +10-25ms per API call (acceptable trade-off)
- **Bundle Size:** -90% (significant improvement)
- **Maintainability:** Much better (prompts hidden, easier updates)
- **Scalability:** Better (can optimize backend independently)
- **Security:** Better (prompts not exposed)

**Recommendation:** The slight latency increase (10-25ms) is acceptable given the significant benefits in maintainability, security, and bundle size. The impact is minimal compared to LLM response times (500ms-5s).

---

## 4. Additional Considerations

### Security Benefits
- ✅ Prompts hidden from users
- ✅ Can implement rate limiting
- ✅ Can add authentication if needed
- ✅ Can log/audit API usage

### Maintainability Benefits
- ✅ Prompts can be updated without extension updates
- ✅ Can A/B test different prompts
- ✅ Centralized prompt management
- ✅ Easier to debug and optimize

### Scalability Benefits
- ✅ Can add caching layers
- ✅ Can implement request queuing
- ✅ Can add analytics
- ✅ Can support multiple clients

### Migration Strategy
1. Implement new APIs alongside existing proxy
2. Update extension to use new APIs gradually
3. Keep old proxy as fallback
4. Remove old proxy after full migration
5. Monitor for issues

---

## 5. Next Steps

1. **Review and Approve** this proposal
2. **Prioritize Endpoints** - which to implement first
3. **Set Up Development Environment** - Vercel API structure
4. **Begin Phase 1** - Infrastructure setup
5. **Iterate** - Implement and test each phase
