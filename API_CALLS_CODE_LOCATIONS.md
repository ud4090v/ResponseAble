# API Calls - Exact Code Locations

This document shows the exact code locations for all 11 API calls in `src/pages/Content/index.jsx`.

---

## Helper Functions (Lines 35-157)

### `callProxyAPI` - Non-streaming API calls
**Location:** Lines 35-71
```javascript
const callProxyAPI = async (provider, model, messages, temperature = 0.8, max_tokens = 1000) => {
    // Makes POST request to VERCEL_PROXY_URL
    // Returns complete JSON response
}
```

### `callProxyAPIStream` - Streaming API calls
**Location:** Lines 75-157
```javascript
const callProxyAPIStream = async (provider, model, messages, temperature = 0.8, max_tokens = 1000, onChunk = null, abortSignal = null) => {
    // Makes POST request with stream: true
    // Calls onChunk callback with each chunk
    // Returns full accumulated content
}
```

---

## API Call #1: User Style Analysis

**Function:** `analyzeUserStyle()`  
**Location:** Lines 551-557  
**File:** `src/pages/Content/index.jsx`

```javascript
const styleData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    messages,
    0.3,  // temperature
    500   // max_tokens
);
```

**Full Context:**
- **Function starts at:** Line 480
- **Messages constructed at:** Lines 540-549
- **API call at:** Lines 551-557
- **Response processing:** Lines 559-582

**Called from:** `classifyEmail()` function when `enableStyleMimicking` is true

---

## API Call #2: Email Type Classification (Reply)

**Function:** `classifyEmail()`  
**Location:** Lines 697-703  
**File:** `src/pages/Content/index.jsx`

```javascript
const typeData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    typeDeterminationMessages,
    0.3,  // temperature
    1200  // max_tokens - increased to ensure complete JSON responses
);
```

**Full Context:**
- **Function starts at:** Line 602
- **Messages constructed at:** Lines 681-693
- **API call at:** Lines 697-703
- **Response processing:** Lines 705-724

**Called from:** `generateDraftsWithTone()` → `classifyEmail()` for Reply actions

---

## API Call #3: Generic Goals Determination (Reply)

**Function:** `classifyEmail()`  
**Location:** Lines 802-808  
**File:** `src/pages/Content/index.jsx`

```javascript
const genericGoalsData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    genericGoalsMessages,
    0.3,
    1500
);
```

**Full Context:**
- **Function:** `classifyEmail()` (starts at line 602)
- **Messages constructed at:** Lines 794-799
- **API call at:** Lines 802-808
- **Response processing:** Lines 809-846

**Called from:** `classifyEmail()` when matched_type is 'generic' package

---

## API Call #4: Intent & Goals Determination (Reply - Specific Package)

**Function:** `classifyEmail()`  
**Location:** Lines 934-940  
**File:** `src/pages/Content/index.jsx`

```javascript
const intentGoalsData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    intentGoalsMessages,
    0.3,
    1500
);
```

**Full Context:**
- **Function:** `classifyEmail()` (starts at line 602)
- **Messages constructed at:** Lines 920-931
- **API call at:** Lines 934-940
- **Response processing:** Lines 941-961

**Called from:** `classifyEmail()` when matched_type is NOT 'generic' package

---

## API Call #5: Tone Determination (Reply)

**Function:** `classifyEmail()`  
**Location:** Lines 1003-1009  
**File:** `src/pages/Content/index.jsx`

```javascript
const toneData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    toneDynamicMessages,
    0.3,
    800
);
```

**Full Context:**
- **Function:** `classifyEmail()` (starts at line 602)
- **Messages constructed at:** Lines 987-999
- **API call at:** Lines 1003-1009
- **Response processing:** Lines 1010-1095

**Called from:** `classifyEmail()` after goals are determined (both generic and specific paths)

---

## API Call #6: Draft Generation (Reply)

**Function:** `generateDraftsWithTone()`  
**Location:** Lines 3378-3392  
**File:** `src/pages/Content/index.jsx`

```javascript
draftText = await callProxyAPIStream(
    apiConfig.provider,
    apiConfig.model,
    messages,
    0.8,  // temperature
    800 * numVariants,  // max_tokens (increase for multiple variants)
    // onChunk callback - called with each new chunk of content
    (fullContent, newChunk) => {
        // Call onComplete with partial content for incremental UI updates
        if (onComplete) {
            onComplete(fullContent, true); // true = isPartial
        }
    },
    null  // abortSignal - could be added for cancellation support
);
```

**Full Context:**
- **Function starts at:** Line 3269
- **Messages constructed at:** Lines 3287-3373
- **API call at:** Lines 3378-3392
- **Response processing:** Lines 3404-3420

**Called from:** `generateDraftsWithTone()` after all classification steps complete

---

## API Call #7: Email Type Classification (New Draft / Forward)

**Function:** `injectGenerateButton()` → Forward/New Draft flow  
**Location:** Lines 3014-3020  
**File:** `src/pages/Content/index.jsx`

```javascript
const typeData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    typeMessages,
    0.3,
    800
);
```

**Full Context:**
- **Function:** `injectGenerateButton()` (starts at line 2706)
- **Messages constructed at:** Lines 3010-3012
- **API call at:** Lines 3014-3020
- **Response processing:** Lines 3022-3043

**Called from:** `injectGenerateButton()` when user clicks Generate on new email or forward (only if user typed content)

---

## API Call #8: Tone Determination (New Draft / Forward - Generic Package)

**Function:** `generateGenericSingleDraft()`  
**Location:** Lines 3484-3490  
**File:** `src/pages/Content/index.jsx`

```javascript
const toneData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    toneMessages,
    0.3,
    800
);
```

**Full Context:**
- **Function starts at:** Line 3424
- **Messages constructed at:** Lines 3475-3482
- **API call at:** Lines 3484-3490
- **Response processing:** Lines 3491-3532

**Called from:** `generateGenericSingleDraft()` when generating new draft with generic package

---

## API Call #9: Goals Determination (New Draft / Forward - Specific Package)

**Function:** `generateDraftsForNewEmail()`  
**Location:** Lines 3665-3671  
**File:** `src/pages/Content/index.jsx`

```javascript
const goalsData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    goalsMessages,
    0.3,
    1500
);
```

**Full Context:**
- **Function starts at:** Line 3597
- **Messages constructed at:** Lines 3640-3662
- **API call at:** Lines 3665-3671
- **Response processing:** Lines 3672-3699

**Called from:** `generateDraftsForNewEmail()` when generating new draft with non-generic package

---

## API Call #10: Tone Determination (New Draft / Forward - Specific Package)

**Function:** `generateDraftsForNewEmail()`  
**Location:** Lines 3779-3785  
**File:** `src/pages/Content/index.jsx`

```javascript
const toneData = await callProxyAPI(
    apiConfig.provider,
    classificationModel,
    toneMessages,
    0.3,
    800
);
```

**Full Context:**
- **Function:** `generateDraftsForNewEmail()` (starts at line 3597)
- **Messages constructed at:** Lines 3755-3776
- **API call at:** Lines 3779-3785
- **Response processing:** Lines 3786-3832

**Called from:** `generateDraftsForNewEmail()` after goals are determined

---

## API Call #11: Draft Generation (New Draft / Forward)

**Function:** `generateGenericSingleDraft()`  
**Location:** Lines 4309-4324  
**File:** `src/pages/Content/index.jsx`

```javascript
draftsText = await callProxyAPIStream(
    apiConfig.provider,
    apiConfig.model,
    messages,
    0.8,  // temperature
    800,  // max_tokens
    // onChunk callback - called with each new chunk of content
    (fullContent, newChunk) => {
        // Call onComplete with partial content for incremental UI updates
        // The overlay will re-render with the partial content
        if (onComplete) {
            onComplete(fullContent, true); // true = isPartial
        }
    },
    null  // abortSignal - could be added for cancellation support
);
```

**Full Context:**
- **Function:** `generateGenericSingleDraft()` (starts at line 3424)
- **Messages constructed at:** Lines 4287-4304
- **API call at:** Lines 4309-4324
- **Response processing:** Lines 4336-4342

**Called from:** `generateGenericSingleDraft()` after tone determination

---

## Additional API Call: LinkedIn Comment Generation

**Note:** This is a special case for LinkedIn comments, not part of the main email flow.

**Function:** LinkedIn comment handler  
**Location:** Lines 5246-5252  
**File:** `src/pages/Content/index.jsx`

```javascript
const data = await callProxyAPI(
    apiConfig.provider,
    apiConfig.model,
    messages,
    0.7,  // temperature
    1000  // max_tokens
);
```

**Full Context:**
- **Messages constructed at:** Lines 5235-5244
- **API call at:** Lines 5246-5252
- **Response processing:** Lines 5253-5256

**Called from:** LinkedIn comment generation handler (separate from email flow)

---

## Summary Table

| # | API Call | Function | Lines | Type | Temperature | Max Tokens |
|---|----------|----------|-------|------|-------------|------------|
| 1 | User Style Analysis | `analyzeUserStyle()` | 551-557 | Non-streaming | 0.3 | 500 |
| 2 | Type Classification (Reply) | `classifyEmail()` | 697-703 | Non-streaming | 0.3 | 1200 |
| 3 | Generic Goals (Reply) | `classifyEmail()` | 802-808 | Non-streaming | 0.3 | 1500 |
| 4 | Intent & Goals (Reply) | `classifyEmail()` | 934-940 | Non-streaming | 0.3 | 1500 |
| 5 | Tone Determination (Reply) | `classifyEmail()` | 1003-1009 | Non-streaming | 0.3 | 800 |
| 6 | Draft Generation (Reply) | `generateDraftsWithTone()` | 3378-3392 | **Streaming** | 0.8 | 800×variants |
| 7 | Type Classification (New) | `injectGenerateButton()` | 3014-3020 | Non-streaming | 0.3 | 800 |
| 8 | Tone (New - Generic) | `generateGenericSingleDraft()` | 3484-3490 | Non-streaming | 0.3 | 800 |
| 9 | Goals (New - Specific) | `generateDraftsForNewEmail()` | 3665-3671 | Non-streaming | 0.3 | 1500 |
| 10 | Tone (New - Specific) | `generateDraftsForNewEmail()` | 3779-3785 | Non-streaming | 0.3 | 800 |
| 11 | Draft Generation (New) | `generateGenericSingleDraft()` | 4309-4324 | **Streaming** | 0.8 | 800 |

---

## Call Flow Diagrams

### Reply Flow:
```
injectGenerateButton() [2706]
  └─> generateDraftsWithTone() [3269]
      └─> classifyEmail() [602]
          ├─> analyzeUserStyle() [480] → API Call #1 [551]
          ├─> Type Classification → API Call #2 [697]
          ├─> Generic Goals (if generic) → API Call #3 [802]
          ├─> Intent & Goals (if specific) → API Call #4 [934]
          └─> Tone Determination → API Call #5 [1003]
      └─> Draft Generation → API Call #6 [3378] (STREAMING)
```

### New Draft / Forward Flow:
```
injectGenerateButton() [2706]
  └─> Forward/New Draft handler [~2968]
      ├─> Type Classification → API Call #7 [3014]
      └─> generateDraftsForNewEmail() [3597]
          ├─> Goals (if specific) → API Call #9 [3665]
          └─> Tone (if specific) → API Call #10 [3779]
      └─> generateGenericSingleDraft() [3424]
          ├─> Tone (if generic) → API Call #8 [3484]
          └─> Draft Generation → API Call #11 [4309] (STREAMING)
```

---

## Notes

- **All API calls** go through the Vercel proxy at `https://xrepl.app/api/generate`
- **Streaming calls** (#6, #11) use `callProxyAPIStream` with `onChunk` callbacks
- **Non-streaming calls** (#1-5, #7-10) use `callProxyAPI` and return complete JSON
- **Classification model** is typically `gpt-4o-mini` (OpenAI) or `grok-4-fast` (Grok)
- **Generation model** uses the user's selected model from settings
- **Temperature:** 0.3 for analysis/classification, 0.8 for generation
