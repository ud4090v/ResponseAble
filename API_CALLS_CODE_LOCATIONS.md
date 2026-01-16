# API Calls - Complete Code Locations & Status

**Last Updated:** December 2024  
**File:** `src/pages/Content/index.jsx`  
**Total Lines:** 5,250  
**Base URL:** `https://xrepl.app/api`

---

## Executive Summary

**Status:** ✅ **ALL API CALLS REFACTORED** - All 11 main API calls + LinkedIn comments now use dedicated server-side endpoints.

### Refactoring Status

| # | API Call | Status | Endpoint | Lines |
|---|----------|--------|----------|-------|
| 1 | User Style Analysis | ✅ Refactored | `/api/analyze-style` | 605-625 |
| 2 | Email Type Classification (Reply) | ✅ Refactored | `/api/classify-email-type` | 715-735 |
| 3 | Generic Goals (Reply) | ✅ Refactored | `/api/determine-goals-generic` | 788-808 |
| 4 | Intent & Goals (Reply) | ✅ Refactored | `/api/determine-goals-reply` | 898-918 |
| 5 | Tone Determination (Reply) | ✅ Refactored | `/api/determine-tones-reply` | 945-965 |
| 6 | Draft Generation (Reply) | ✅ Refactored | `/api/generate-drafts-reply` | 4108-4128 |
| 7 | Type Classification (New) | ✅ Refactored | `/api/classify-draft-type` | 2927-2947 |
| 8 | Tone (New - Generic) | ✅ Refactored | `/api/determine-tones-draft-generic` | 3309-3329 |
| 9 | Goals (New - Specific) | ✅ Refactored | `/api/determine-goals-draft` | 3450-3470 |
| 10 | Tone (New - Specific) | ✅ Refactored | `/api/determine-tones-draft-specific` | 3554-3574 |
| 11 | Draft Generation (New) | ✅ Refactored | `/api/generate-drafts-draft` | 4080-4100 |
| + | LinkedIn Comments | ✅ Refactored | `/api/generate-drafts-draft` | 5049-5075 |

---

## Helper Functions

### `callProxyAPI` - Legacy Non-streaming API (Still Used for Backward Compatibility)
**Location:** Lines 35-71  
**Purpose:** Generic proxy to `/api/generate` endpoint (legacy, still available but not used by refactored calls)

```javascript
const callProxyAPI = async (provider, model, messages, temperature = 0.8, max_tokens = 1000) => {
    const response = await fetch(`${VERCEL_PROXY_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, messages, temperature, max_tokens })
    });
    return await response.json();
}
```

### `callProxyAPIStream` - Legacy Streaming API (Still Used for Backward Compatibility)
**Location:** Lines 75-157  
**Purpose:** Generic streaming proxy to `/api/generate` endpoint (legacy, still available but not used by refactored calls)

```javascript
const callProxyAPIStream = async (provider, model, messages, temperature = 0.8, max_tokens = 1000, onChunk = null, abortSignal = null) => {
    const response = await fetch(`${VERCEL_PROXY_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, messages, temperature, max_tokens, stream: true })
    });
    // ... streaming logic ...
}
```

### `callNewStreamingAPI` - New Streaming Helper
**Location:** Lines 160-220  
**Purpose:** Helper for streaming calls to new dedicated endpoints

```javascript
const callNewStreamingAPI = async (endpointUrl, requestBody, onChunk = null, abortSignal = null) => {
    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortSignal
    });
    // ... streaming logic with Server-Sent Events format ...
}
```

---

## API Call #1: User Style Analysis ✅ REFACTORED

**Function:** `analyzeWritingStyle()`  
**Location:** Lines 605-625  
**Endpoint:** `/api/analyze-style`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/analyze-style`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userEmails: userEmails,
        platform: platform,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const styleData = await response.json();
```

**Full Context:**
- **Function starts at:** Line 593
- **API call at:** Lines 605-625
- **Response processing:** Lines 627-640
- **Returns:** `{ writing_style, tone_preferences, communication_patterns }`

**Called from:** `classifyEmail()` when `enableStyleMimicking` is true (line 647)

---

## API Call #2: Email Type Classification (Reply) ✅ REFACTORED

**Function:** `classifyEmail()`  
**Location:** Lines 715-735  
**Endpoint:** `/api/classify-email-type`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/classify-email-type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        emailContent: emailBeingRepliedTo,
        richContext: {
            recipientName: richContext.recipientName,
            recipientCompany: richContext.recipientCompany,
            subject: richContext.subject
        },
        availablePackages: userPackages,
        confidenceThreshold: apiConfig.classificationConfidenceThreshold,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const typeMatchResult = await response.json();
```

**Full Context:**
- **Function starts at:** Line 647
- **API call at:** Lines 715-735
- **Response processing:** Lines 737-760
- **Returns:** `{ matched_type, confidence, matched_package }`

**Called from:** `generateDraftsWithTone()` → `classifyEmail()` for Reply actions

---

## API Call #3: Generic Goals Determination (Reply) ✅ REFACTORED

**Function:** `classifyEmail()`  
**Location:** Lines 788-808  
**Endpoint:** `/api/determine-goals-generic`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/determine-goals-generic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        emailContent: emailBeingRepliedTo,
        richContext: {
            recipientName: richContext.recipientName,
            recipientCompany: richContext.recipientCompany,
            subject: richContext.subject
        },
        numGoals: apiConfig.numGoals || 3,
        numVariants: numVariants,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const genericGoalsResult = await response.json();
```

**Full Context:**
- **Function:** `classifyEmail()` (starts at line 647)
- **API call at:** Lines 788-808
- **Response processing:** Lines 810-846
- **Returns:** `{ response_goals, goal_titles, variant_sets, recipient_name, recipient_company, key_topics }`

**Called from:** `classifyEmail()` when matched_type is 'generic' package

---

## API Call #4: Intent & Goals Determination (Reply - Specific Package) ✅ REFACTORED

**Function:** `classifyEmail()`  
**Location:** Lines 898-918  
**Endpoint:** `/api/determine-goals-reply`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/determine-goals-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        emailContent: emailBeingRepliedTo,
        richContext: {
            recipientName: richContext.recipientName,
            recipientCompany: richContext.recipientCompany,
            subject: richContext.subject
        },
        package: matchedPackage,
        numGoals: apiConfig.numGoals || 3,
        numVariants: numVariants,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const intentGoalsResult = await response.json();
```

**Full Context:**
- **Function:** `classifyEmail()` (starts at line 647)
- **API call at:** Lines 898-918
- **Response processing:** Lines 920-961
- **Returns:** `{ intent, response_goals, goal_titles, variant_sets, recipient_name, recipient_company, key_topics }`

**Called from:** `classifyEmail()` when matched_type is NOT 'generic' package

---

## API Call #5: Tone Determination (Reply) ✅ REFACTORED

**Function:** `classifyEmail()`  
**Location:** Lines 945-965  
**Endpoint:** `/api/determine-tones-reply`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/determine-tones-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        emailContent: emailBeingRepliedTo,
        threadHistory: previousThreadHistory,
        intent: intentGoalsResult.intent,
        responseGoals: intentGoalsResult.response_goals,
        numTones: apiConfig.numTones || 3,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const toneResult = await response.json();
```

**Full Context:**
- **Function:** `classifyEmail()` (starts at line 647)
- **API call at:** Lines 945-965
- **Response processing:** Lines 967-1025
- **Returns:** `{ tone_needed, tone_sets }`

**Called from:** `classifyEmail()` after goals are determined (both generic and specific paths)

---

## API Call #6: Draft Generation (Reply) ✅ REFACTORED

**Function:** `generateDraftsWithTone()`  
**Location:** Lines 4108-4128  
**Endpoint:** `/api/generate-drafts-reply`  
**Type:** Streaming  
**Status:** ✅ Fully refactored

```javascript
draftsText = await callNewStreamingAPI(
    `${VERCEL_PROXY_URL}/generate-drafts-reply`,
    {
        emailContent: emailBeingRepliedTo,
        threadHistory: previousThreadHistory,
        package: matchedPackage,
        variantSet: variantSet,
        currentGoal: currentGoal,
        goalTone: goalTone,
        recipientName: classification.recipient_name,
        recipientCompany: classification.recipient_company,
        senderName: senderName,
        intent: classification.intent,
        keyTopics: classification.key_topics,
        writingStyle: classification.writing_style,
        enableStyleMimicking: apiConfig.enableStyleMimicking,
        platform: platform,
        provider: apiConfig.provider,
        model: apiConfig.model,
        temperature: 0.8,
        max_tokens: 2000
    },
    (fullContent, newChunk) => {
        if (onComplete) {
            onComplete(fullContent, true); // true = isPartial
        }
    }
);
```

**Full Context:**
- **Function starts at:** Line 3685
- **API call at:** Lines 4108-4128
- **Response processing:** Lines 4130-4145
- **Returns:** Full draft text with variants separated by `|||RESPONSE_VARIANT|||`

**Called from:** `generateDraftsWithTone()` after all classification steps complete

---

## API Call #7: Email Type Classification (New Draft / Forward) ✅ REFACTORED

**Function:** `injectGenerateButton()` → Forward/New Draft flow  
**Location:** Lines 2927-2947  
**Endpoint:** `/api/classify-draft-type`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/classify-draft-type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        typedContent: composeBodyText,
        availablePackages: userPackages,
        confidenceThreshold: apiConfig.classificationConfidenceThreshold,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const typeResult = await response.json();
```

**Full Context:**
- **Function:** `injectGenerateButton()` (starts at line 2655)
- **API call at:** Lines 2927-2947
- **Response processing:** Lines 2949-2995
- **Returns:** `{ matched_type, confidence, matched_package }`

**Called from:** `injectGenerateButton()` when user clicks Generate on new email or forward (only if user typed content)

---

## API Call #8: Tone Determination (New Draft / Forward - Generic Package) ✅ REFACTORED

**Function:** `generateGenericSingleDraft()`  
**Location:** Lines 3309-3329  
**Endpoint:** `/api/determine-tones-draft-generic`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored (Recently fixed)

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/determine-tones-draft-generic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        typedContent: bodyText || '',
        subject: subject || '',
        recipient: recipient || '',
        numTones: apiConfig.numTones || 3,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const parsedToneResult = await response.json();
```

**Full Context:**
- **Function starts at:** Line 3185
- **API call at:** Lines 3309-3329
- **Response processing:** Lines 3331-3365
- **Returns:** `{ tone_needed, tone_sets }` (already cleaned server-side)

**Called from:** `generateGenericSingleDraft()` when generating new draft with generic package

---

## API Call #9: Goals Determination (New Draft / Forward - Specific Package) ✅ REFACTORED

**Function:** `generateDraftsForNewEmail()`  
**Location:** Lines 3450-3470  
**Endpoint:** `/api/determine-goals-draft`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/determine-goals-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userIntent: userIntent,
        typedContent: typedContentContext,
        recipientName: recipientName,
        recipientCompany: recipientCompany,
        platform: platform,
        numGoals: apiConfig.numGoals || 3,
        numVariants: numVariants,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const intentGoalsResult = await response.json();
```

**Full Context:**
- **Function starts at:** Line 3411
- **API call at:** Lines 3450-3470
- **Response processing:** Lines 3472-3544
- **Returns:** `{ response_goals, goal_titles, variant_sets, recipient_name, recipient_company, key_topics }`

**Called from:** `generateDraftsForNewEmail()` when generating new draft with non-generic package

---

## API Call #10: Tone Determination (New Draft / Forward - Specific Package) ✅ REFACTORED

**Function:** `generateDraftsForNewEmail()`  
**Location:** Lines 3554-3574  
**Endpoint:** `/api/determine-tones-draft-specific`  
**Type:** Non-streaming  
**Status:** ✅ Fully refactored

```javascript
const response = await fetch(`${VERCEL_PROXY_URL}/determine-tones-draft-specific`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userIntent: userIntent,
        responseGoals: intentGoalsResult.response_goals,
        numTones: apiConfig.numTones || 3,
        provider: apiConfig.provider,
        model: classificationModel
    })
});
const toneResult = await response.json();
```

**Full Context:**
- **Function:** `generateDraftsForNewEmail()` (starts at line 3411)
- **API call at:** Lines 3554-3574
- **Response processing:** Lines 3576-3632
- **Returns:** `{ tone_needed, tone_sets }`

**Called from:** `generateDraftsForNewEmail()` after goals are determined

---

## API Call #11: Draft Generation (New Draft / Forward) ✅ REFACTORED

**Function:** `generateDraftsWithTone()` (for new emails)  
**Location:** Lines 4080-4100  
**Endpoint:** `/api/generate-drafts-draft`  
**Type:** Streaming  
**Status:** ✅ Fully refactored

```javascript
draftsText = await callNewStreamingAPI(
    `${VERCEL_PROXY_URL}/generate-drafts-draft`,
    {
        typedContent: classification.composeBodyText,
        package: matchedPackage,
        variantSet: variantSet,
        currentGoal: currentGoal,
        goalTone: goalTone,
        recipientName: classification.recipient_name,
        recipientCompany: classification.recipient_company,
        userIntent: matchedPackage.userIntent,
        keyTopics: classification.key_topics || [],
        writingStyle: classification.writing_style,
        enableStyleMimicking: apiConfig.enableStyleMimicking,
        platform: platform,
        provider: apiConfig.provider,
        model: apiConfig.model,
        temperature: 0.8,
        max_tokens: 2000
    },
    (fullContent, newChunk) => {
        if (onComplete) {
            onComplete(fullContent, true); // true = isPartial
        }
    }
);
```

**Full Context:**
- **Function:** `generateDraftsWithTone()` (starts at line 3685)
- **API call at:** Lines 4080-4100 (for new emails)
- **Response processing:** Lines 4102-4145
- **Returns:** Full draft text with variants separated by `|||RESPONSE_VARIANT|||`

**Called from:** `generateDraftsWithTone()` for new email drafts (when `isNewEmail` is true)

---

## Additional API Call: LinkedIn Comment Generation ✅ REFACTORED

**Function:** LinkedIn comment handler  
**Location:** Lines 5049-5075  
**Endpoint:** `/api/generate-drafts-draft`  
**Type:** Streaming  
**Status:** ✅ Fully refactored

```javascript
const draftsText = await callNewStreamingAPI(
    `${VERCEL_PROXY_URL}/generate-drafts-draft`,
    {
        typedContent: commentContext || '',
        package: {
            name: 'generic',
            userIntent: 'Generate professional LinkedIn comment responses',
            roleDescription: 'Professional LinkedIn comment writer',
            contextSpecific: 'Generate engaging, professional comments for LinkedIn posts'
        },
        variantSet: ['Friendly', 'Insightful', 'Professional', 'Concise'],
        currentGoal: 'Generate appropriate comment',
        goalTone: 'Professional',
        recipientName: null,
        recipientCompany: null,
        userIntent: 'Generate professional LinkedIn comment responses',
        keyTopics: [],
        writingStyle: null,
        enableStyleMimicking: false,
        platform: 'linkedin',
        provider: apiConfig.provider,
        model: apiConfig.model,
        temperature: 0.7,
        max_tokens: 1000
    },
    null // No streaming updates for comments
);
```

**Full Context:**
- **Function:** LinkedIn comment handler (starts around line 4936)
- **API call at:** Lines 5049-5075
- **Response processing:** Lines 5076-5093
- **Returns:** Full comment text with variants separated by `|||RESPONSE_VARIANT|||`

**Called from:** LinkedIn comment generation handler (separate from email flow)

---

## Summary Table

| # | API Call | Function | Lines | Endpoint | Type | Temp | Max Tokens | Status |
|---|----------|----------|-------|----------|------|------|------------|--------|
| 1 | User Style Analysis | `analyzeWritingStyle()` | 605-625 | `/api/analyze-style` | Non-streaming | 0.3 | 500 | ✅ |
| 2 | Type Classification (Reply) | `classifyEmail()` | 715-735 | `/api/classify-email-type` | Non-streaming | 0.3 | 1200 | ✅ |
| 3 | Generic Goals (Reply) | `classifyEmail()` | 788-808 | `/api/determine-goals-generic` | Non-streaming | 0.3 | 1500 | ✅ |
| 4 | Intent & Goals (Reply) | `classifyEmail()` | 898-918 | `/api/determine-goals-reply` | Non-streaming | 0.3 | 1500 | ✅ |
| 5 | Tone Determination (Reply) | `classifyEmail()` | 945-965 | `/api/determine-tones-reply` | Non-streaming | 0.3 | 800 | ✅ |
| 6 | Draft Generation (Reply) | `generateDraftsWithTone()` | 4108-4128 | `/api/generate-drafts-reply` | **Streaming** | 0.8 | 2000 | ✅ |
| 7 | Type Classification (New) | `injectGenerateButton()` | 2927-2947 | `/api/classify-draft-type` | Non-streaming | 0.3 | 800 | ✅ |
| 8 | Tone (New - Generic) | `generateGenericSingleDraft()` | 3309-3329 | `/api/determine-tones-draft-generic` | Non-streaming | 0.3 | 800 | ✅ |
| 9 | Goals (New - Specific) | `generateDraftsForNewEmail()` | 3450-3470 | `/api/determine-goals-draft` | Non-streaming | 0.3 | 1500 | ✅ |
| 10 | Tone (New - Specific) | `generateDraftsForNewEmail()` | 3554-3574 | `/api/determine-tones-draft-specific` | Non-streaming | 0.3 | 800 | ✅ |
| 11 | Draft Generation (New) | `generateDraftsWithTone()` | 4080-4100 | `/api/generate-drafts-draft` | **Streaming** | 0.8 | 2000 | ✅ |
| + | LinkedIn Comments | Comment handler | 5049-5075 | `/api/generate-drafts-draft` | **Streaming** | 0.7 | 1000 | ✅ |

---

## Call Flow Diagrams

### Reply Flow:
```
injectGenerateButton() [2655]
  └─> generateDraftsWithTone() [3685]
      └─> classifyEmail() [647]
          ├─> analyzeWritingStyle() [593] → API Call #1 [605] ✅
          ├─> Type Classification → API Call #2 [715] ✅
          ├─> Generic Goals (if generic) → API Call #3 [788] ✅
          ├─> Intent & Goals (if specific) → API Call #4 [898] ✅
          └─> Tone Determination → API Call #5 [945] ✅
      └─> Draft Generation → API Call #6 [4108] ✅ (STREAMING)
```

### New Draft / Forward Flow:
```
injectGenerateButton() [2655]
  └─> Forward/New Draft handler [~2700]
      ├─> Type Classification → API Call #7 [2927] ✅
      └─> generateDraftsForNewEmail() [3411]
          ├─> Goals (if specific) → API Call #9 [3450] ✅
          └─> Tone (if specific) → API Call #10 [3554] ✅
      └─> generateGenericSingleDraft() [3185]
          ├─> Tone (if generic) → API Call #8 [3309] ✅
          └─> Draft Generation → API Call #11 [4080] ✅ (STREAMING)
```

### LinkedIn Comment Flow:
```
injectCommentButton() [~5142]
  └─> Comment handler [~4936]
      └─> Draft Generation → LinkedIn API Call [5049] ✅ (STREAMING)
```

---

## Key Changes from Previous Documentation

### ✅ All Calls Refactored
- **Previous:** Calls used `callProxyAPI`/`callProxyAPIStream` with client-side prompt construction
- **Current:** All calls use dedicated endpoints with server-side prompt construction

### ✅ Updated Line Numbers
- Line numbers have been updated to reflect current codebase state
- All calls verified and tested

### ✅ New Helper Function
- `callNewStreamingAPI` (lines 160-220) added for streaming calls to new endpoints
- Uses Server-Sent Events (SSE) format instead of custom streaming protocol

### ✅ Endpoint Structure
- All endpoints follow pattern: `/api/{function-name}`
- Base URL: `https://xrepl.app/api`
- All prompts moved to server-side (hidden from client)

---

## Notes

- **All API calls** now go through dedicated Vercel endpoints
- **Streaming calls** (#6, #11, LinkedIn) use `callNewStreamingAPI` with SSE format
- **Non-streaming calls** (#1-5, #7-10) use direct `fetch()` calls
- **Classification model** is typically `gpt-4o-mini` (OpenAI) or `grok-4-fast` (Grok)
- **Generation model** uses the user's selected model from settings
- **Temperature:** 0.3 for analysis/classification, 0.8 for generation, 0.7 for LinkedIn comments
- **Legacy functions** (`callProxyAPI`, `callProxyAPIStream`) still exist for backward compatibility but are not used by refactored calls

---

## Code Quality Metrics

- **Total API Calls:** 12 (11 main + 1 LinkedIn)
- **Refactored:** 12/12 (100%)
- **Lines Removed:** ~850 (prompt construction, JSON parsing, etc.)
- **Lines Added:** ~270 (direct API calls)
- **Net Reduction:** ~580 lines
- **Prompts Hidden:** 100% (all prompts now server-side)
- **Security Improvement:** ✅ All prompts protected from client-side exposure
