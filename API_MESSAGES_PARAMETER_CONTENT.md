# Exact Content of `messages` Parameter for Each API Call

This document shows the **exact content** that is passed in the `messages` parameter when `callProxyAPI` or `callProxyAPIStream` is called.

---

## API Call #1: User Style Analysis

**Location:** Line 551  
**Function:** `analyzeUserStyle()`

```javascript
messages = [
  {
    role: 'system',
    content: `Analyze the writing style of the user's emails below and return ONLY a JSON object with:
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
${combinedText}  // Up to 10 recent user emails joined with "\n\n---\n\n"

Return ONLY valid JSON, no other text.`
  },
  {
    role: 'user',
    content: 'Analyze the writing style from the emails above.'
  }
]
```

---

## API Call #2: Email Type Classification (Reply)

**Location:** Line 697  
**Function:** `classifyEmail()`

```javascript
messages = [
  {
    role: 'system',
    content: `Available packages:
${typesWithContext}  // Compact package info: "name: description" for each package

Classify the email into one of the packages above. Return JSON:
{"matched_type":{"name":"package_name","description":"...","intent":"...","roleDescription":"...","contextSpecific":"..."},"confidence":0.0-1.0,"reason":"brief explanation"}

Rules: Only use packages listed. If unclear, use base package. Focus on the specific email content, not thread history.`
  },
  {
    role: 'user',
    content: `=== EMAIL BEING REPLIED TO ===
${emailBeingRepliedTo}  // The actual email text being replied to

${richContext.recipientName || richContext.to ? `Recipient: ${richContext.recipientName || richContext.to}${richContext.recipientCompany ? ` (${richContext.recipientCompany})` : ''}` : ''}${richContext.subject && richContext.subject !== 'LinkedIn Message' ? `\nSubject: ${richContext.subject}` : ''}`
  }
]
```

**Note:** Thread history is explicitly NOT included here to avoid classification bias.

---

## API Call #3: Generic Goals Determination (Reply)

**Location:** Line 802  
**Function:** `classifyEmail()`

```javascript
messages = [
  {
    role: 'system',
    content: `You are an expert email classifier. The intent has ALREADY been determined as a generic professional intent. Your task is to determine appropriate response goals that are contextually relevant to the email while staying within generic professional boundaries.

The generic intent is: "${genericIntent}"  // e.g., "General inquiry or follow-up"

CRITICAL: Do NOT analyze the email content to determine or infer any intent. The intent is already provided above as generic. However, you SHOULD use the email content to understand the context and determine contextually appropriate response goals.

Return a JSON object with:
{
  "response_goals": Array of up to ${apiConfig.numGoals || 3} most appropriate goals for the recipient's reply, ranked by suitability. These goals should be contextually relevant to the email content while remaining generic professional responses. Prioritize positive, constructive, and engaging response goals (e.g., "Express interest", "Request more information", "Schedule a discussion") over negative or defensive ones (e.g., "Politely decline", "Reject the offer"). The first goal should be the most positive and constructive response option.
  "goal_titles": Object with keys matching response_goals, each containing a short title (2-4 words max) suitable for a tab label.
  "variant_sets": Object with keys matching response_goals, each containing array of exactly ${numVariants} specific variant labels ranked by relevance.
  "recipient_name": string (the name of the person who SENT this email${actualSenderName ? ` - should be "${actualSenderName}"` : ''}),
  "recipient_company": string or null (the company of the person who SENT this email),
  "key_topics": array of strings (max 5, based on the email content)
}

Email content (use this to understand context for determining appropriate goals):
${emailBeingRepliedTo}

${richContext.recipientName || richContext.to ? `Sender: ${richContext.recipientName || richContext.to}${richContext.recipientCompany ? ` (${richContext.recipientCompany})` : ''}` : ''}${richContext.subject && richContext.subject !== 'LinkedIn Message' ? `\nSubject: ${richContext.subject}` : ''}

CRITICAL INSTRUCTIONS:
- The intent is ALREADY determined as: "${genericIntent}" - do NOT analyze the email to determine intent
- Use the email content to understand the context and determine contextually appropriate goals
- Prioritize positive, constructive response goals (express interest, request information, engage positively) as the first/recommended goal
- Goals should be generic professional responses but contextually relevant to what the sender is offering/asking
- Only use the email content to extract recipient_name, recipient_company, and key_topics
- Do NOT include an "intent" field in your JSON response - the intent is already determined
- Return ONLY valid JSON, no other text.`
  }
]
```

**Note:** Only system message, no user message.

---

## API Call #4: Intent & Goals Determination (Reply - Specific Package)

**Location:** Line 934  
**Function:** `classifyEmail()`

```javascript
messages = [
  {
    role: 'system',
    content: `You are an expert email classifier. Analyze ONLY the provided email and return a JSON object with:
{
  "intent": Determine the sender's primary intent from the recipient's perspective. What is the sender specifically asking, requesting, or doing in THIS email? Be specific and contextual.
  "response_goals": Array of up to ${apiConfig.numGoals || 3} most appropriate goals for the recipient's reply, ranked by suitability. These goals MUST be based on and directly address the intent you determined above. Each goal should be a specific action the recipient should take to respond to that intent.
  "goal_titles": Object with keys matching response_goals, each containing a short title (2-4 words max) suitable for a tab label.
  "variant_sets": Object with keys matching response_goals, each containing array of exactly ${numVariants} specific variant labels ranked by relevance.
  "recipient_name": string (the name of the person who SENT this email${actualSenderName ? ` - should be "${actualSenderName}"` : ''}),
  "recipient_company": string or null (the company of the person who SENT this email),
  "key_topics": array of strings (max 5, based on the email content)
}

CRITICAL INSTRUCTIONS:
Return ONLY valid JSON, no other text.`
  },
  {
    role: 'user',
    content: `${emailBeingRepliedTo}

${richContext.recipientName || richContext.to ? `Sender: ${richContext.recipientName || richContext.to}${richContext.recipientCompany ? ` (${richContext.recipientCompany})` : ''}` : ''}${richContext.subject && richContext.subject !== 'LinkedIn Message' ? `\nSubject: ${richContext.subject}` : ''}`
  }
]
```

---

## API Call #5: Tone Determination (Reply)

**Location:** Line 1003  
**Function:** `classifyEmail()`

```javascript
messages = [
  {
    role: 'system',
    content: `You are an expert at analyzing conversation tone and dynamics. Based on the email thread provided, determine the optimal tone for a reply.

The intent has already been determined as: "${intentGoalsResult.intent}"
The response goals are: ${JSON.stringify(intentGoalsResult.response_goals)}

Analyze the conversation history to determine:
1. The overall relationship dynamic (formal/informal, professional/casual)
2. The appropriate tone for responding
3. Tone options for each response goal

Return ONLY a JSON object with:
{
  "tone_needed": string (the single most appropriate tone for the reply - must be a SHORT tone name, 1-2 words max, NOT a full sentence),
  "tone_sets": Object with keys matching these goals: ${JSON.stringify(intentGoalsResult.response_goals)}, each containing array of ${apiConfig.numTones || 3} SHORT tone names (1-2 words max) ranked by appropriateness for the relationship. Each tone must be a SHORT descriptive word, NOT a full sentence or email content.
}

Return ONLY valid JSON, no other text.`
  },
  {
    role: 'user',
    content: `=== SPECIFIC EMAIL BEING REPLIED TO ===
${emailBeingRepliedTo}

${previousThreadHistory ? `=== FULL THREAD HISTORY (for tone/dynamic analysis) ===\n${previousThreadHistory}` : '(No previous thread history available)'}`
  }
]
```

**Note:** This is the only classification call that includes thread history (for tone analysis).

---

## API Call #6: Draft Generation (Reply) - STREAMING

**Location:** Line 3378  
**Function:** `generateDraftsWithTone()`

```javascript
messages = [
  {
    role: 'system',
    content: systemPrompt  // This is a very long prompt that includes:
      // - Package-specific role description and context
      // - User style profile (if enabled)
      // - Intent, goals, tone sets
      // - Variant strategies
      // - Formatting instructions
      // - Example format
      // Full content spans lines 3100-3362
  },
  {
    role: 'user',
    content: `Generate ${numVariants} professional ${platform === 'linkedin' ? 'LinkedIn message' : 'email'} draft variants${recipientName ? ` for ${recipientName}${recipientCompany ? ` at ${recipientCompany}` : ''}` : ' for [Recipient]'} based on the context provided.${!recipientName ? ' Use [Recipient] as placeholder for the recipient name.' : ''}`
  }
]
```

**Full System Prompt Content (for Reply):**
The system prompt includes:
- Package role description (`roleDescription`)
- Package context-specific instructions (`contextSpecific`)
- User intent and response goals
- Tone sets for each goal
- Variant strategies
- User style profile (if `enableStyleMimicking` is true)
- Formatting requirements
- Example format

**User Content (for Reply):**
```javascript
userContent = `=== EMAIL BEING REPLIED TO (YOU ARE REPLYING TO THIS - IGNORE EVERYTHING ELSE BELOW) ===
${emailBeingRepliedTo}

${previousThreadHistory ? `=== PREVIOUS THREAD HISTORY (IGNORE THIS - FOR BACKGROUND CONTEXT ONLY) ===
${previousThreadHistory}

REMINDER: You are replying to the "EMAIL BEING REPLIED TO" section above. DO NOT respond to anything in the thread history. The thread history is only for understanding background context, NOT for determining what to respond to.

` : ''}${richContext.recipientName || richContext.to ? `Recipient: ${richContext.recipientName || richContext.to}${richContext.recipientCompany ? ` (${richContext.recipientCompany})` : ''}` : ''}${richContext.subject && richContext.subject !== 'LinkedIn Message' ? `\nSubject: ${richContext.subject}` : ''}

${senderName || recipientName ? `IMPORTANT: The person who sent you this ${platform === 'linkedin' ? 'message' : 'email'} is named "${senderName || recipientName}"${recipientCompany ? ` from ${recipientCompany}` : ''}. You are replying TO them. Address them by their actual name "${senderName || recipientName}" in your greeting. Do NOT use "Google", "Hi there", "Hello", or any generic greeting - use their actual name "${senderName || recipientName}".\n\n` : 'IMPORTANT: Extract the sender\'s name from the email above and use it in your greeting. Do NOT use generic greetings like "Hi Google" or "Hello there".\n\n'}CRITICAL - Do NOT include in your response:
- A subject line (it's already set)
- Your signature, name, email address, phone number, or company name (${platform === 'gmail' ? 'Gmail will automatically add your signature' : 'signatures are not needed'})
- Made-up names, companies, or contact information
- Generic greetings like "Hi Google" or "Hello there" - use the actual sender's name
- Any text after the closing (no signatures, no contact info)
- Labels like "1. Friendly response" or "2. Insightful response" - just write the actual email text`
```

---

## API Call #7: Email Type Classification (New Draft / Forward)

**Location:** Line 3014  
**Function:** `injectGenerateButton()` → Forward/New Draft flow

```javascript
messages = [
  {
    role: 'system',
    content: `Available packages:
${typesWithContext}  // Compact package info

Classify the email into one of the packages above. Return JSON:
{
  "matched_type": {
    "name": string,                 // the package name (e.g., "sales")
    "description": string,          // full description from the package
    "userIntent": string,           // full userIntent from the package
    "roleDescription": string,      // full roleDescription from the package
    "contextSpecific": string       // full contextSpecific from the package
  },
  "confidence": number (0.0 to 1.0), // how strong the match is
  "reason": string                  // brief explanation
}

Email content to classify:
${composeContext}  // User's typed content (subject, to, body)

Rules:
- Only choose from the listed packages above.
- Match based on what YOU (the user) are drafting in the email content
- Use the description and userIntent to determine which package matches YOUR role
- Return the COMPLETE matched_type object including name, description, userIntent, roleDescription, and contextSpecific from the matched package.
- Return ONLY valid JSON, no other text.`
  }
]
```

**Note:** Only system message, no user message. Uses user's typed content, NOT forwarded message.

---

## API Call #8: Tone Determination (New Draft / Forward - Generic Package)

**Location:** Line 3484  
**Function:** `generateGenericSingleDraft()`

```javascript
messages = [
  {
    role: 'system',
    content: `You are an expert at determining appropriate email tone. Based on the context provided below, determine the optimal tone options for a new email.

Context:
${composeContext}  // Subject, To, Email content

Return ONLY a JSON object with:
{
  "tone_needed": string (the single most appropriate default tone for this new email - must be a SHORT tone name, 1-2 words max, NOT a full sentence),
  "tone_sets": Object with key "Generate appropriate draft", containing array of ${apiConfig.numTones || 3} SHORT tone names (1-2 words max) ranked by appropriateness. Each tone must be a SHORT descriptive word, NOT a full sentence or email content.
}

Return ONLY valid JSON, no other text.`
  }
]
```

**Note:** Only system message, no user message.

---

## API Call #9: Goals Determination (New Draft / Forward - Specific Package)

**Location:** Line 3665  
**Function:** `generateDraftsForNewEmail()`

```javascript
messages = [
  {
    role: 'system',
    content: `You are an expert email strategist. Based on the user's intent provided below${typedContentContext ? ' and the typed email content' : ''}, determine the most appropriate goals and strategies for composing a new email.

The user's intent is: "${userIntent}"${typedContentContext}  // Package userIntent + typed content if available

Return a JSON object with:
{
  "response_goals": Array of up to 5 most appropriate goals for composing this new email, ranked by suitability. These goals MUST be based on and directly address the sender intent provided above${typedContentContext ? ' and the specific typed content' : ''}. Each goal should be a specific action or strategy the sender should pursue to achieve that intent.
  "goal_titles": Object with keys matching response_goals, each containing a short title (2-4 words max) suitable for a tab label.
  "variant_sets": Object with keys matching response_goals, each containing array of exactly ${numVariants} specific variant labels ranked by relevance.
  "recipient_name": string${recipientName ? ` - should be "${recipientName}"` : ' or null if not available'},
  "recipient_company": string${recipientCompany ? ` - should be "${recipientCompany}"` : ' or null if not available'},
  "key_topics": array of strings (max 5, potential topics to cover in the email based on the intent${typedContentContext ? ' and typed content' : ''})
}

Context:
${recipientName ? `Recipient: ${recipientName}${recipientCompany ? ` at ${recipientCompany}` : ''}` : 'Recipient: [Recipient] (name not available)'}
Platform: ${platform === 'linkedin' ? 'LinkedIn' : 'Email'}

CRITICAL INSTRUCTIONS:
- Use the sender intent provided above${typedContentContext ? ' AND the typed email content' : ''} to determine goals
- Goals should be specific strategies/approaches for achieving the sender's intent${typedContentContext ? ' based on the actual content they typed' : ''}
- Variants should represent different ways to pursue each goal
- Key topics should reflect the actual content typed by the user
- Return ONLY valid JSON, no other text.`
  }
]
```

**Note:** Only system message, no user message.

---

## API Call #10: Tone Determination (New Draft / Forward - Specific Package)

**Location:** Line 3779  
**Function:** `generateDraftsForNewEmail()`

```javascript
messages = [
  {
    role: 'system',
    content: `You are an expert at determining appropriate email tone. Based on the user's intent and goals, determine the optimal tone options for a new email.

The user's intent is: "${userIntent}"
The email goals are: ${JSON.stringify(intentGoalsResult.response_goals)}

Return ONLY a JSON object with:
{
  "tone_needed": string (the single most appropriate default tone for this new email - must be a SHORT tone name, 1-2 words max, NOT a full sentence),
  "tone_sets": Object with keys matching these goals: ${JSON.stringify(intentGoalsResult.response_goals)}, each containing array of ${apiConfig.numTones || 3} SHORT tone names (1-2 words max) ranked by appropriateness. Each tone must be a SHORT descriptive word, NOT a full sentence or email content.
}

Return ONLY valid JSON, no other text.`
  }
]
```

**Note:** Only system message, no user message.

---

## API Call #11: Draft Generation (New Draft / Forward) - STREAMING

**Location:** Line 4309  
**Function:** `generateGenericSingleDraft()`

```javascript
messages = [
  {
    role: 'system',
    content: systemPrompt  // Long prompt for new email generation
      // Includes:
      // - Platform-specific instructions (LinkedIn vs Email)
      // - Recipient information
      // - Signature instructions
      // - Formatting requirements
      // - Example format
      // Full content spans lines 3289-3362
  },
  {
    role: 'user',
    content: userContent  // Different for new email vs reply
  }
]
```

**System Prompt Content (for New Email):**
```javascript
// For LinkedIn:
systemPrompt = `You are a professional LinkedIn message writer. Generate exactly ${numVariants} complete, personalized message draft variants based on the context provided below. Each variant should have a different approach, tone, or style while addressing the same context.

Context:
${composeContext}  // Subject, To, Email content

CRITICAL INSTRUCTIONS:
${recipientDisplay !== '[Recipient]' ? `- Address the recipient as "${recipientDisplay}"${recipientCompany ? ` from ${recipientCompany}` : ''} in your greeting.` : `- Use "[Recipient]" as placeholder for the recipient's name in your greeting.`}
- ${signatureInstructions}  // Use "[Name]" or actual name
- Use "[Company]" as placeholder for your company name if needed
- Do NOT make up recipient names, company names, or your own name/company
- Do NOT include signatures with made-up contact information
- Base the drafts on the context provided above

IMPORTANT FORMATTING REQUIREMENTS:
- Generate ${numVariants} complete message drafts, each ready to send, including greeting, body text, and closing
- Separate each draft with exactly "|||RESPONSE_VARIANT|||" on its own line (CRITICAL: use this exact separator, do not modify it)
- Do NOT include variant labels, numbers, or strategy names in the drafts
- Start each message directly with the greeting
- Keep each message under 150 words
- Sound human, not robotic
- Each variant should offer a different approach (e.g., more formal, more casual, more concise, more detailed, etc.)

Example format:
${recipientDisplay !== '[Recipient]' ? `Hi ${recipientDisplay},` : 'Hi [Recipient],'}

[Message body text variant 1]

Best regards,
${userAccountName || '[Name]'}
|||RESPONSE_VARIANT|||
${recipientDisplay !== '[Recipient]' ? `Hi ${recipientDisplay},` : 'Hi [Recipient],'}

[Message body text variant 2]

Best regards,
${userAccountName || '[Name]'}`

// For Email (similar structure but with "Dear" instead of "Hi")
```

**User Content (for New Email):**
```javascript
userContent = `Generate ${variantSet.length} professional ${platform === 'linkedin' ? 'LinkedIn message' : 'email'} drafts${classification.recipient_name && classification.recipient_name !== '[Recipient]' ? ` for ${classification.recipient_name}${classification.recipient_company ? ` at ${classification.recipient_company}` : ''}` : ' for [Recipient]'}. Each draft should use a different approach from the variant strategies provided.${!classification.recipient_name || classification.recipient_name === '[Recipient]' ? ' Use [Recipient] as placeholder for the recipient name.' : ''}

${classification.recipient_name && classification.recipient_name !== '[Recipient]' ? `Recipient: ${classification.recipient_name}${classification.recipient_company ? ` (${classification.recipient_company})` : ''}` : 'Recipient: [Recipient] (name not available)'}

CRITICAL - Do NOT include in your response:
- A subject line (it's already set)
- Your signature, name, email address, phone number, or company name (${platform === 'gmail' ? 'Gmail will automatically add your signature' : 'signatures are not needed'})
- Made-up names, companies, or contact information
- Generic greetings like "Hi Google" or "Hello there"${classification.recipient_name && classification.recipient_name !== '[Recipient]' ? ` - use "${classification.recipient_name}"` : ' - use [Recipient] as placeholder'}
- Any text after the closing (no signatures, no contact info)
- Labels like "1. Friendly response" or "2. Insightful response" - just write the actual email text`
```

---

## Summary

### Message Structure Pattern:

1. **Classification/Analysis Calls (#1-5, #7-10):**
   - Usually 1-2 messages
   - System message with instructions and prompt
   - Optional user message with data/context
   - Temperature: 0.3 (low for consistency)

2. **Draft Generation Calls (#6, #11):**
   - Always 2 messages
   - System message with comprehensive instructions
   - User message with context and formatting requirements
   - Temperature: 0.8 (higher for creativity)
   - **Streaming:** Uses `callProxyAPIStream` with `onChunk` callback

### Key Variables Used:

- `${emailBeingRepliedTo}` - The specific email being replied to
- `${previousThreadHistory}` - Full thread history (only for tone analysis)
- `${composeContext}` - User's typed content (for new drafts)
- `${richContext.recipientName}` - Recipient/sender name
- `${richContext.recipientCompany}` - Recipient/sender company
- `${richContext.subject}` - Email subject
- `${intentGoalsResult.response_goals}` - Determined goals array
- `${apiConfig.numGoals}` - Number of goals from settings
- `${apiConfig.numTones}` - Number of tones from settings
- `${apiConfig.numVariants}` - Number of variants from settings
