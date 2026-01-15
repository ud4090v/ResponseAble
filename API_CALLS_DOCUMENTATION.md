# API Calls Documentation

This document provides a comprehensive overview of all API calls in the xRepl.ai extension, their purposes, inputs, and outputs.

## Architecture Overview

All API calls go through a **Vercel proxy** (`https://xrepl.app/api/generate`) which:
- Handles CORS
- Routes requests to OpenAI or Grok (xAI) APIs
- Manages API keys server-side
- Supports both streaming and non-streaming responses

### Helper Functions

1. **`callProxyAPI`** - Non-streaming API calls
   - Returns complete response as JSON
   - Used for classification and analysis tasks

2. **`callProxyAPIStream`** - Streaming API calls
   - Returns content incrementally via `onChunk` callback
   - Used for draft generation (faster time-to-first-token)

---

## API Call #1: User Style Analysis

**Purpose:** Analyzes the user's writing style from previous emails to enable style mimicking

**Location:** `analyzeUserStyle()` function (line ~551)

**When Called:** 
- Only when `enableStyleMimicking` is enabled in settings
- Before draft generation for Reply actions
- Uses cached style profile if available

**Input:**
```javascript
{
  provider: string,        // 'openai' or 'grok'
  model: string,           // Classification model (usually same as main model)
  messages: [
    {
      role: 'system',
      content: 'Analyze writing style from these emails...'
    },
    {
      role: 'user',
      content: 'Email 1: ...\nEmail 2: ...\n...' // Up to 10 recent emails
    }
  ],
  temperature: 0.3,       // Low temperature for consistent analysis
  max_tokens: 500
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"formality\":\"professional\",\"sentence_length\":\"medium\",\"word_choice\":\"moderate\",\"punctuation_style\":\"standard\",\"greeting_patterns\":[\"Hi\",\"Hello\"],\"closing_patterns\":[\"Best regards\",\"Thanks\"],\"usesEmojis\":false,\"usesExclamations\":true,\"startsWithGreeting\":true,\"endsWithSignOff\":true,\"sample_count\":10}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  formality: 'professional',
  sentence_length: 'medium',
  word_choice: 'moderate',
  punctuation_style: 'standard',
  greeting_patterns: ['Hi', 'Hello'],
  closing_patterns: ['Best regards', 'Thanks'],
  usesEmojis: false,
  usesExclamations: true,
  startsWithGreeting: true,
  endsWithSignOff: true,
  sample_count: 10
}
```

**Used For:** Injected into draft generation prompts to match user's writing style

---

## API Call #2: Email Type Classification (Reply)

**Purpose:** Determines the email type/package that best matches the email being replied to

**Location:** `classifyEmail()` function (line ~697)

**When Called:** 
- When user clicks "Reply" button
- Before goals and tones are determined
- Determines which package (sales, support, etc.) to use

**Input:**
```javascript
{
  provider: string,
  model: string,           // Classification model
  messages: [
    {
      role: 'system',
      content: 'You are an expert at classifying emails. Match to one of these packages: [package list]...'
    },
    {
      role: 'user',
      content: 'Email content: ...\nRecipient: ...\nSubject: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 1200
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"matched_type\":{\"name\":\"sales\",\"description\":\"...\"},\"confidence\":0.92,\"reason\":\"Email contains sales-related content\"}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  matched_type: {
    name: 'sales',
    description: '...',
    // Full package object
  },
  confidence: 0.92,
  reason: 'Email contains sales-related content'
}
```

**Used For:** 
- Selecting the appropriate package for draft generation
- If confidence < threshold (default 0.85), falls back to 'generic' package
- Determines which package-specific prompts to use

---

## API Call #3: Generic Goals Determination (Reply - Generic Package)

**Purpose:** Generates generic response goals when using the 'generic' package (no specific intent)

**Location:** `classifyEmail()` function (line ~802)

**When Called:** 
- Only when matched_type is 'generic' package
- After type classification
- Before tone determination

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Generate generic response goals for this email...'
    },
    {
      role: 'user',
      content: 'Email: ...\nRecipient: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 1500
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"response_goals\":[\"Express interest\",\"Request more information\",\"Schedule a discussion\"],\"goal_titles\":{\"Express interest\":\"Interest\"},\"variant_sets\":{},\"recipient_name\":\"John\",\"recipient_company\":\"Acme Corp\",\"key_topics\":[\"product demo\",\"pricing\"]}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  intent: 'General inquiry or follow-up',  // Always generic
  response_goals: ['Express interest', 'Request more information', 'Schedule a discussion'],
  goal_titles: { 'Express interest': 'Interest' },
  variant_sets: {},
  recipient_name: 'John',
  recipient_company: 'Acme Corp',
  key_topics: ['product demo', 'pricing']
}
```

**Used For:** 
- Provides goals for generic package replies
- Limited to `numGoals` from settings (default 3)
- Goals are used to generate multiple draft variants

---

## API Call #4: Intent & Goals Determination (Reply - Specific Package)

**Purpose:** Determines the specific intent and response goals when using a non-generic package (sales, support, etc.)

**Location:** `classifyEmail()` function (line ~934)

**When Called:** 
- Only when matched_type is NOT 'generic' package
- After type classification
- Before tone determination

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Determine intent and goals based on [package] context. Intent must match package intent...'
    },
    {
      role: 'user',
      content: 'Email: ...\nPackage context: ...\nRecipient: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 1500
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"intent\":\"Customer is interested in product demo\",\"response_goals\":[\"Schedule demo\",\"Provide product info\",\"Qualify lead\"],\"goal_titles\":{\"Schedule demo\":\"Demo\"},\"variant_sets\":{},\"recipient_name\":\"John\",\"recipient_company\":\"Acme Corp\",\"key_topics\":[\"demo\",\"pricing\"]}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  intent: 'Customer is interested in product demo',
  response_goals: ['Schedule demo', 'Provide product info', 'Qualify lead'],
  goal_titles: { 'Schedule demo': 'Demo' },
  variant_sets: {},
  recipient_name: 'John',
  recipient_company: 'Acme Corp',
  key_topics: ['demo', 'pricing']
}
```

**Used For:** 
- Provides package-specific intent and goals
- Limited to `numGoals` from settings
- Intent is used in tone determination prompt

---

## API Call #5: Tone Determination (Reply)

**Purpose:** Determines appropriate tone options for each response goal based on conversation history

**Location:** `classifyEmail()` function (line ~1003)

**When Called:** 
- After goals are determined (both generic and specific paths)
- Uses full thread history for context
- Before draft generation

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Determine optimal tone for reply. Intent: "...", Goals: [...]'
    },
    {
      role: 'user',
      content: 'Email being replied to: ...\nFull thread history: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 800
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"tone_needed\":\"Professional\",\"tone_sets\":{\"Schedule demo\":[\"Professional\",\"Friendly\",\"Enthusiastic\"],\"Provide product info\":[\"Informative\",\"Professional\",\"Helpful\"]}}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  tone_needed: 'Professional',
  tone_sets: {
    'Schedule demo': ['Professional', 'Friendly', 'Enthusiastic'],
    'Provide product info': ['Informative', 'Professional', 'Helpful']
  }
}
```

**Used For:** 
- Provides tone options for each goal
- Limited to `numTones` from settings (default 3)
- Each goal × tone combination generates a draft variant

---

## API Call #6: Draft Generation (Reply)

**Purpose:** Generates the actual email draft text with multiple variants

**Location:** `generateDraftsWithTone()` function (line ~3378)

**When Called:** 
- After all classification steps are complete
- Uses streaming for real-time updates
- Generates multiple variants (goals × tones × numVariants)

**Input:**
```javascript
{
  provider: string,
  model: string,           // Main generation model (can differ from classification model)
  messages: [
    {
      role: 'system',
      content: 'You are a professional email writer. Generate drafts matching user style: {...}...'
    },
    {
      role: 'user',
      content: 'Package: sales\nIntent: ...\nGoals: ...\nTones: ...\nEmail context: ...\nUser style: {...}'
    }
  ],
  temperature: 0.8,       // Higher for creativity
  max_tokens: 800 * numVariants,
  stream: true,
  onChunk: (fullContent, newChunk) => {
    // Called with each chunk for real-time UI updates
    onComplete(fullContent, true); // true = isPartial
  }
}
```

**Output (Streaming):**
```
data: {"choices":[{"delta":{"content":"Hi John"}}]}\n\n
data: {"choices":[{"delta":{"content":","}}]}\n\n
data: {"choices":[{"delta":{"content":"\n\nThanks"}}]}\n\n
...
data: [DONE]\n\n
```

**Processed Output:**
```javascript
// Full draft text (accumulated from stream)
"Hi John,\n\nThanks for your interest in our product. I'd be happy to schedule a demo...\n\nBest regards,\n[Your name]"
```

**Used For:** 
- Displayed in overlay with real-time streaming updates
- Parsed to extract multiple variants (if generated)
- Inserted into email compose window when user selects a variant

---

## API Call #7: Email Type Classification (New Draft / Forward)

**Purpose:** Determines email type for new drafts (when user is composing a new email or forwarding)

**Location:** `injectGenerateButton()` → Forward/New Draft flow (line ~3014)

**When Called:** 
- When user clicks "Generate" on a new email or forward
- Only if user has typed some content
- Uses typed content (not forwarded message) for classification

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Classify this new email draft to determine package...'
    },
    {
      role: 'user',
      content: 'User typed content: ...\nRecipient: ...\nSubject: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 800
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"matched_type\":{\"name\":\"sales\"},\"confidence\":0.88}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  matched_type: { name: 'sales', ... },
  confidence: 0.88
}
```

**Used For:** 
- Selecting package for new draft generation
- If confidence < threshold or no match, uses 'generic' package

---

## API Call #8: Tone Determination (New Draft / Forward - Generic Package)

**Purpose:** Determines tone options when generating a new draft with generic package

**Location:** `generateGenericSingleDraft()` function (line ~3484)

**When Called:** 
- When generating new draft with generic package
- After type classification (if applicable)
- Before draft generation

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Generate tone options for new email draft...'
    },
    {
      role: 'user',
      content: 'Goal: Generate appropriate draft\nContext: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 800
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"tone_sets\":{\"Generate appropriate draft\":[\"Professional\",\"Friendly\",\"Concise\"]}}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  tone_sets: {
    'Generate appropriate draft': ['Professional', 'Friendly', 'Concise']
  }
}
```

**Used For:** 
- Provides tone options for generic new draft
- Limited to `numTones` from settings

---

## API Call #9: Goals Determination (New Draft / Forward - Specific Package)

**Purpose:** Determines response goals for new drafts when using a specific package

**Location:** `generateDraftsForNewEmail()` function (line ~3665)

**When Called:** 
- When generating new draft with non-generic package
- After type classification
- Before tone determination

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Generate goals for new [package] email...'
    },
    {
      role: 'user',
      content: 'User typed content: ...\nPackage: sales\nRecipient: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 1500
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"response_goals\":[\"Introduce yourself\",\"Build rapport\",\"Make a request\"],\"goal_titles\":{},\"variant_sets\":{},\"recipient_name\":\"John\",\"recipient_company\":null,\"key_topics\":[]}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  response_goals: ['Introduce yourself', 'Build rapport', 'Make a request'],
  goal_titles: {},
  variant_sets: {},
  recipient_name: 'John',
  recipient_company: null,
  key_topics: []
}
```

**Used For:** 
- Provides goals for new draft generation
- Limited to `numGoals` from settings

---

## API Call #10: Tone Determination (New Draft / Forward - Specific Package)

**Purpose:** Determines tone options for new drafts with specific package

**Location:** `generateDraftsForNewEmail()` function (line ~3779)

**When Called:** 
- After goals are determined for new draft
- Before draft generation

**Input:**
```javascript
{
  provider: string,
  model: string,
  messages: [
    {
      role: 'system',
      content: 'Determine tone for new email. Goals: [...]'
    },
    {
      role: 'user',
      content: 'Goals: ...\nContext: ...\nRecipient: ...'
    }
  ],
  temperature: 0.3,
  max_tokens: 800
}
```

**Output:**
```json
{
  "choices": [{
    "message": {
      "content": "{\"tone_sets\":{\"Introduce yourself\":[\"Professional\",\"Warm\"],\"Build rapport\":[\"Friendly\",\"Casual\"]}}"
    }
  }]
}
```

**Processed Output:**
```javascript
{
  tone_sets: {
    'Introduce yourself': ['Professional', 'Warm'],
    'Build rapport': ['Friendly', 'Casual']
  }
}
```

**Used For:** 
- Provides tone options for each goal
- Limited to `numTones` from settings

---

## API Call #11: Draft Generation (New Draft / Forward)

**Purpose:** Generates the actual draft text for new emails or forwards

**Location:** `generateDraftsForNewEmail()` → `generateDraftsWithTone()` (line ~3378)

**When Called:** 
- After all classification steps for new draft
- Uses same streaming mechanism as Reply drafts

**Input:** Same as API Call #6 (Draft Generation for Reply)

**Output:** Same as API Call #6 (streaming draft text)

**Used For:** 
- Generating draft variants for new emails
- Same streaming UI updates as Reply

---

## Summary Flow

### Reply Flow:
1. **Style Analysis** (if enabled) → User writing style
2. **Type Classification** → Package selection
3. **Goals Determination** → Response goals (generic or package-specific)
4. **Tone Determination** → Tone options per goal
5. **Draft Generation** (streaming) → Final draft text

### New Draft / Forward Flow:
1. **Type Classification** → Package selection (if user typed content)
2. **Goals Determination** → Response goals
3. **Tone Determination** → Tone options per goal
4. **Draft Generation** (streaming) → Final draft text

---

## Configuration

All API calls use settings from `apiConfig`:
- `provider`: 'openai' or 'grok'
- `model`: Specific model name
- `numVariants`: Number of variants to generate (1-7)
- `numGoals`: Number of goals (1-5, plan-dependent)
- `numTones`: Number of tones per goal (1-5, plan-dependent)
- `classificationConfidenceThreshold`: Minimum confidence for package matching (0.0-1.0, Pro/Ultimate only)
- `enableStyleMimicking`: Whether to analyze and use user style (Pro/Ultimate only)

---

## Error Handling

All API calls include:
- Network error detection (CORS, connection issues)
- JSON parsing with fallbacks
- Markdown code block removal
- Default/fallback values for failed calls
- User-friendly error messages
