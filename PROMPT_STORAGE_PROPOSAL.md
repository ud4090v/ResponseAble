# Prompt Storage Strategy for Backend API

## Current State
Prompts are embedded directly in the extension code as template strings, making them:
- Hard to update (requires extension update)
- Visible to users (security concern)
- Difficult to A/B test
- Mixed with business logic

## Proposed Storage Approach

### Recommended: **Hybrid Approach - Template Files + Code Functions**

Store prompts in separate template files, but use code functions to construct them dynamically.

---

## Option 1: Template Files (Recommended) ⭐

### Structure:
```
responsable-api/
├── api/
│   ├── analyze-style.js
│   ├── classify-email-type.js
│   └── ...
├── prompts/
│   ├── style-analysis.js
│   ├── classification.js
│   ├── goals-generic.js
│   ├── goals-specific.js
│   ├── tones-reply.js
│   ├── tones-draft.js
│   ├── draft-reply.js
│   └── draft-draft.js
└── utils/
    └── prompt-builder.js
```

### Example: `prompts/style-analysis.js`
```javascript
export const buildStyleAnalysisPrompt = (userEmails) => {
  const combinedText = userEmails.join('\n\n---\n\n');
  
  return `Analyze the writing style of the user's emails below and return ONLY a JSON object with:
{
  "formality": "formal" | "professional" | "professional-casual" | "casual",
  "sentence_length": "short" | "medium" | "long",
  "word_choice": "simple" | "moderate" | "complex",
  "punctuation_style": "minimal" | "standard" | "frequent" | "emojis",
  "greeting_patterns": ["array of greeting patterns found, e.g., 'Hi [Name],', 'Hello,'"],
  "closing_patterns": ["array of closing patterns found, e.g., 'Best regards,', 'Thanks,'"],
  "usesEmojis": boolean (true if user frequently uses emojis, false otherwise),
  "usesExclamations": boolean (true if user frequently uses exclamation marks, false otherwise),
  "startsWithGreeting": boolean (true if user typically starts emails with a greeting, false otherwise),
  "endsWithSignOff": boolean (true if user typically ends emails with a sign-off/closing, false otherwise)
}

Analyze these user emails:
${combinedText}

Return ONLY valid JSON, no other text.`;
};

export const buildStyleAnalysisMessages = (userEmails) => {
  return [
    {
      role: 'system',
      content: buildStyleAnalysisPrompt(userEmails)
    },
    {
      role: 'user',
      content: 'Analyze the writing style from the emails above.'
    }
  ];
};
```

### Example: `prompts/classification.js`
```javascript
export const buildEmailTypeClassificationPrompt = (availablePackages, confidenceThreshold = 0.85) => {
  const typesWithContext = availablePackages
    .map(p => `${p.name}: ${p.description}`)
    .join('\n');
  
  return `Available packages:
${typesWithContext}

Classify the email into one of the packages above. Return JSON:
{"matched_type":{"name":"package_name","description":"...","intent":"...","roleDescription":"...","contextSpecific":"..."},"confidence":0.0-1.0,"reason":"brief explanation"}

Rules: Only use packages listed. If unclear, use base package. Focus on the specific email content, not thread history.`;
};

export const buildEmailTypeClassificationMessages = (emailContent, recipientName, recipientCompany, subject, availablePackages, confidenceThreshold) => {
  const prompt = buildEmailTypeClassificationPrompt(availablePackages, confidenceThreshold);
  
  return [
    {
      role: 'system',
      content: prompt
    },
    {
      role: 'user',
      content: `=== EMAIL BEING REPLIED TO ===
${emailContent}

${recipientName ? `Recipient: ${recipientName}${recipientCompany ? ` (${recipientCompany})` : ''}` : ''}${subject && subject !== 'LinkedIn Message' ? `\nSubject: ${subject}` : ''}`
    }
  ];
};
```

### Example: `prompts/draft-reply.js`
```javascript
export const buildDraftReplySystemPrompt = ({
  package: pkg,
  intent,
  responseGoals,
  toneSets,
  variantStrategies,
  userStyleProfile,
  numVariants,
  platform,
  recipientName,
  recipientCompany,
  userAccountName
}) => {
  // Build the comprehensive system prompt for reply generation
  // This is the long prompt that includes package context, style, goals, etc.
  
  const styleInstructions = userStyleProfile 
    ? `\n\nUSER WRITING STYLE (match this style):
- Formality: ${userStyleProfile.formality}
- Sentence length: ${userStyleProfile.sentence_length}
- Word choice: ${userStyleProfile.word_choice}
- Punctuation: ${userStyleProfile.punctuation_style}
- Greeting patterns: ${userStyleProfile.greeting_patterns?.join(', ') || 'Standard'}
- Closing patterns: ${userStyleProfile.closing_patterns?.join(', ') || 'Standard'}
- Uses emojis: ${userStyleProfile.usesEmojis ? 'Yes' : 'No'}
- Uses exclamations: ${userStyleProfile.usesExclamations ? 'Yes' : 'No'}
- Starts with greeting: ${userStyleProfile.startsWithGreeting ? 'Yes' : 'No'}
- Ends with sign-off: ${userStyleProfile.endsWithSignOff ? 'Yes' : 'No'}`
    : '';
  
  const roleContext = pkg.roleDescription || '';
  const contextSpecific = pkg.contextSpecific || '';
  
  return `You are a professional ${platform === 'linkedin' ? 'LinkedIn message' : 'email'} writer specializing in ${pkg.name} communications.

${roleContext}

${contextSpecific}

The sender's intent is: "${intent}"
Response goals: ${JSON.stringify(responseGoals)}
Tone options: ${JSON.stringify(toneSets)}
${variantStrategies ? `Variant strategies: ${JSON.stringify(variantStrategies)}` : ''}${styleInstructions}

CRITICAL INSTRUCTIONS:
- Generate exactly ${numVariants} complete ${platform === 'linkedin' ? 'message' : 'email'} drafts
- Each draft should address the specific email being replied to
- Use appropriate tone based on conversation history
- Match the user's writing style if provided
- Separate drafts with "|||RESPONSE_VARIANT|||"
- Do NOT include subject lines, signatures, or labels
- Keep each draft under 150 words
- Sound human, not robotic`;
};

export const buildDraftReplyUserContent = ({
  emailContent,
  threadHistory,
  recipientName,
  recipientCompany,
  subject,
  senderName,
  platform
}) => {
  return `=== EMAIL BEING REPLIED TO (YOU ARE REPLYING TO THIS - IGNORE EVERYTHING ELSE BELOW) ===
${emailContent}

${threadHistory ? `=== PREVIOUS THREAD HISTORY (IGNORE THIS - FOR BACKGROUND CONTEXT ONLY) ===
${threadHistory}

REMINDER: You are replying to the "EMAIL BEING REPLIED TO" section above. DO NOT respond to anything in the thread history. The thread history is only for understanding background context, NOT for determining what to respond to.

` : ''}${recipientName ? `Recipient: ${recipientName}${recipientCompany ? ` (${recipientCompany})` : ''}` : ''}${subject && subject !== 'LinkedIn Message' ? `\nSubject: ${subject}` : ''}

${senderName ? `IMPORTANT: The person who sent you this ${platform === 'linkedin' ? 'message' : 'email'} is named "${senderName}". Address them by their actual name "${senderName}" in your greeting. Do NOT use "Google", "Hi there", "Hello", or any generic greeting - use their actual name "${senderName}".\n\n` : ''}CRITICAL - Do NOT include in your response:
- A subject line (it's already set)
- Your signature, name, email address, phone number, or company name
- Made-up names, companies, or contact information
- Generic greetings like "Hi Google" or "Hello there" - use the actual sender's name
- Any text after the closing (no signatures, no contact info)
- Labels like "1. Friendly response" or "2. Insightful response" - just write the actual email text`;
};
```

### Usage in API Endpoint: `api/analyze-style.js`
```javascript
import { buildStyleAnalysisMessages } from '../prompts/style-analysis.js';
import { callLLM } from '../utils/llm-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userEmails, provider = 'openai', model } = req.body;

  // Validate
  if (!userEmails || !Array.isArray(userEmails)) {
    return res.status(400).json({ error: 'userEmails array is required' });
  }

  try {
    // Build messages using prompt template
    const messages = buildStyleAnalysisMessages(userEmails);
    
    // Determine model
    const classificationModel = provider === 'openai' 
      ? (model || 'gpt-4o-mini')
      : (model || 'grok-4-fast');

    // Call LLM
    const response = await callLLM(provider, classificationModel, messages, {
      temperature: 0.3,
      max_tokens: 500
    });

    // Parse and validate response
    let styleContent = response.choices?.[0]?.message?.content || '{}';
    styleContent = styleContent.trim();
    
    // Clean markdown code blocks
    if (styleContent.startsWith('```json')) {
      styleContent = styleContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (styleContent.startsWith('```')) {
      styleContent = styleContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const styleAnalysis = JSON.parse(styleContent);
    
    // Return structured response
    res.status(200).json({
      formality: styleAnalysis.formality || 'professional',
      sentence_length: styleAnalysis.sentence_length || 'medium',
      word_choice: styleAnalysis.word_choice || 'moderate',
      punctuation_style: styleAnalysis.punctuation_style || 'standard',
      greeting_patterns: styleAnalysis.greeting_patterns || [],
      closing_patterns: styleAnalysis.closing_patterns || [],
      usesEmojis: styleAnalysis.usesEmojis === true,
      usesExclamations: styleAnalysis.usesExclamations === true,
      startsWithGreeting: styleAnalysis.startsWithGreeting !== false,
      endsWithSignOff: styleAnalysis.endsWithSignOff !== false,
      sample_count: userEmails.length
    });
  } catch (error) {
    console.error('Style analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

---

## Option 2: JSON Configuration Files

### Structure:
```
responsable-api/
├── prompts/
│   ├── style-analysis.json
│   ├── classification.json
│   └── ...
```

### Example: `prompts/style-analysis.json`
```json
{
  "system": {
    "template": "Analyze the writing style of the user's emails below and return ONLY a JSON object with:\n{...}\n\nAnalyze these user emails:\n{{userEmails}}\n\nReturn ONLY valid JSON, no other text.",
    "variables": ["userEmails"]
  },
  "user": {
    "template": "Analyze the writing style from the emails above.",
    "variables": []
  }
}
```

**Pros:**
- Easy to edit (non-developers can update)
- Can be loaded dynamically
- Easy to version control

**Cons:**
- Requires template engine (mustache, handlebars, etc.)
- Less flexible for complex logic
- Harder to debug

**Not recommended** - JSON is too rigid for complex prompts with conditional logic.

---

## Option 3: Environment Variables

### Structure:
Store prompts in environment variables or Vercel environment settings.

**Pros:**
- Can be updated without code deployment
- Easy to have different prompts per environment

**Cons:**
- Hard to manage long prompts
- No version control
- Difficult to test
- Security concerns (exposed in logs)

**Not recommended** - Environment variables are for configuration, not content.

---

## Option 4: Database/External Service

### Structure:
Store prompts in database (Supabase, PostgreSQL) or external service.

**Pros:**
- Can update without deployment
- Easy A/B testing
- Analytics on prompt performance
- Version history

**Cons:**
- Adds database dependency
- Network latency for fetching prompts
- More complex architecture
- Overkill for current needs

**Future consideration** - Good for production optimization, but not needed initially.

---

## Option 5: Hybrid: Code + Config

### Structure:
- Core prompts in code (template files)
- Configurable parameters in JSON
- A/B test variants in database (future)

```
responsable-api/
├── prompts/
│   ├── style-analysis.js      // Core prompt
│   └── ...
├── config/
│   ├── prompt-config.json     // Parameters, versions
│   └── ...
```

### Example: `config/prompt-config.json`
```json
{
  "styleAnalysis": {
    "version": "1.0",
    "temperature": 0.3,
    "maxTokens": 500,
    "enabled": true
  },
  "classification": {
    "version": "1.2",
    "confidenceThreshold": 0.85,
    "temperature": 0.3,
    "maxTokens": 1200
  }
}
```

**Recommended for future** - Start with Option 1, evolve to this.

---

## Recommended Approach: Option 1 (Template Files)

### Why Template Files?

1. **Version Control**
   - Prompts are in Git
   - Easy to track changes
   - Can review prompt updates in PRs

2. **Type Safety**
   - Can use TypeScript for prompt functions
   - IDE autocomplete
   - Compile-time checks

3. **Flexibility**
   - Can include complex logic
   - Easy to parameterize
   - Can conditionally include sections

4. **Performance**
   - No database lookups
   - No network requests
   - Fast execution

5. **Maintainability**
   - Clear separation of concerns
   - Easy to find and update prompts
   - Can test prompts independently

6. **Security**
   - Prompts not exposed to clients
   - Can add authentication later
   - Can log prompt usage

### Implementation Structure:

```
responsable-api/
├── api/
│   ├── analyze-style.js
│   ├── classify-email-type.js
│   └── ...
├── prompts/
│   ├── index.js                    // Export all prompts
│   ├── style-analysis.js
│   ├── classification.js
│   ├── goals/
│   │   ├── generic.js
│   │   ├── reply.js
│   │   └── draft.js
│   ├── tones/
│   │   ├── reply.js
│   │   ├── draft-generic.js
│   │   └── draft-specific.js
│   └── drafts/
│       ├── reply.js
│       └── draft.js
├── utils/
│   ├── llm-client.js
│   ├── prompt-builder.js           // Shared utilities
│   └── response-parser.js
└── config/
    └── packages.json               // Package definitions
```

### Prompt File Structure:

Each prompt file exports:
1. **Prompt builder function** - Constructs the prompt string
2. **Messages builder function** - Constructs full messages array
3. **Validation function** - Validates inputs (optional)

### Example: `prompts/goals/generic.js`
```javascript
/**
 * Generic goals determination prompts
 * Used when email matches generic/base package
 */

export const buildGenericGoalsPrompt = ({
  emailContent,
  genericIntent,
  recipientName,
  recipientCompany,
  subject,
  numGoals = 3,
  numVariants = 4
}) => {
  return `You are an expert email classifier. The intent has ALREADY been determined as a generic professional intent. Your task is to determine appropriate response goals that are contextually relevant to the email while staying within generic professional boundaries.

The generic intent is: "${genericIntent}"

CRITICAL: Do NOT analyze the email content to determine or infer any intent. The intent is already provided above as generic. However, you SHOULD use the email content to understand the context and determine contextually appropriate response goals.

Return a JSON object with:
{
  "response_goals": Array of up to ${numGoals} most appropriate goals for the recipient's reply, ranked by suitability. These goals should be contextually relevant to the email content while remaining generic professional responses. Prioritize positive, constructive, and engaging response goals (e.g., "Express interest", "Request more information", "Schedule a discussion") over negative or defensive ones (e.g., "Politely decline", "Reject the offer"). The first goal should be the most positive and constructive response option.
  "goal_titles": Object with keys matching response_goals, each containing a short title (2-4 words max) suitable for a tab label.
  "variant_sets": Object with keys matching response_goals, each containing array of exactly ${numVariants} specific variant labels ranked by relevance.
  "recipient_name": string (the name of the person who SENT this email${recipientName ? ` - should be "${recipientName}"` : ''}),
  "recipient_company": string or null (the company of the person who SENT this email),
  "key_topics": array of strings (max 5, based on the email content)
}

Email content (use this to understand context for determining appropriate goals):
${emailContent}

${recipientName ? `Sender: ${recipientName}${recipientCompany ? ` (${recipientCompany})` : ''}` : ''}${subject && subject !== 'LinkedIn Message' ? `\nSubject: ${subject}` : ''}

CRITICAL INSTRUCTIONS:
- The intent is ALREADY determined as: "${genericIntent}" - do NOT analyze the email to determine intent
- Use the email content to understand the context and determine contextually appropriate goals
- Prioritize positive, constructive response goals (express interest, request information, engage positively) as the first/recommended goal
- Goals should be generic professional responses but contextually relevant to what the sender is offering/asking
- Only use the email content to extract recipient_name, recipient_company, and key_topics
- Do NOT include an "intent" field in your JSON response - the intent is already determined
- Return ONLY valid JSON, no other text.`;
};

export const buildGenericGoalsMessages = (params) => {
  return [
    {
      role: 'system',
      content: buildGenericGoalsPrompt(params)
    }
  ];
};

// Validation function
export const validateGenericGoalsInput = (params) => {
  const errors = [];
  
  if (!params.emailContent) {
    errors.push('emailContent is required');
  }
  
  if (!params.genericIntent) {
    errors.push('genericIntent is required');
  }
  
  if (params.numGoals && (params.numGoals < 1 || params.numGoals > 10)) {
    errors.push('numGoals must be between 1 and 10');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
```

---

## Future Evolution Path

### Phase 1: Template Files (Initial)
- Prompts in code files
- Version controlled
- Easy to maintain

### Phase 2: Add Configuration (6 months)
- Move parameters to config files
- Enable prompt versioning
- Add feature flags

### Phase 3: A/B Testing (12 months)
- Store prompt variants in database
- Track performance metrics
- Automatically select best prompts

### Phase 4: Dynamic Prompts (18 months)
- ML-optimized prompts
- User-specific prompt tuning
- Real-time prompt optimization

---

## Best Practices

### 1. **Prompt Organization**
- Group related prompts in folders
- Use descriptive file names
- Keep prompts focused (one purpose per file)

### 2. **Parameterization**
- Make prompts configurable
- Use function parameters, not hardcoded values
- Document all parameters

### 3. **Versioning**
- Include version comments in prompts
- Track prompt changes in Git
- Consider semantic versioning for prompts

### 4. **Testing**
- Unit test prompt construction
- Test with various inputs
- Validate prompt outputs

### 5. **Documentation**
- Document prompt purpose
- Document parameters
- Document expected outputs
- Include examples

### 6. **Security**
- Never expose prompts to clients
- Sanitize user inputs in prompts
- Log prompt usage (for auditing)

---

## Recommendation Summary

**Use Option 1: Template Files (JavaScript/TypeScript)**

- ✅ Prompts in separate files
- ✅ Functions to build prompts dynamically
- ✅ Version controlled in Git
- ✅ Easy to maintain and update
- ✅ Type-safe (with TypeScript)
- ✅ No external dependencies
- ✅ Fast execution

**Start simple, evolve as needed:**
1. Template files now
2. Add config files later
3. Add database for A/B testing when needed
