# Action Type Determination Walkthrough

## Overview
The system determines whether the user is composing a **Reply**, **New Email**, or **Forward** using a multi-factor detection algorithm. This happens in the `detectComposeAction()` function.

## Entry Point
**Location**: `src/pages/Content/index.jsx` - Line ~2690

```javascript
// Use multi-factor detection to determine compose action type
let composeAction = 'new';
if (adapter.detectComposeAction) {
    composeAction = adapter.detectComposeAction();
} else {
    // Fallback to old method if detectComposeAction not available
    if (adapter.isReply && adapter.isReply()) {
        composeAction = 'reply';
    } else if (adapter.isForward && adapter.isForward()) {
        composeAction = 'forward';
    }
}

const isReply = composeAction === 'reply';
const isForward = composeAction === 'forward';
```

## Detection Algorithm: `detectComposeAction()`

**Location**: `src/pages/Content/index.jsx` - Line ~1535 (Gmail) / Line ~2360 (LinkedIn)

The function uses a **priority-based multi-factor detection** system with 4 priority levels:

### PRIORITY 1: Attribution Line (Most Reliable)
Checks for Gmail's attribution elements in the DOM:

1. **Check `.gmail_attr` element**:
   - Looks for element with class `gmail_attr`
   - If text contains `"wrote:"` → **Returns `'reply'`**
   - Example: "John Doe wrote:"

2. **Check quoted content with attribution**:
   - Finds `div.gmail_quote`, `blockquote.gmail_quote`, or `blockquote`
   - Checks previous sibling element for attribution
   - If contains `"wrote:"` → **Returns `'reply'`**
   - If contains `"Forwarded message"` or `"Original Message"` → **Returns `'forward'`**

### PRIORITY 2: Content Patterns in Compose Body
Analyzes the actual text content in the compose box:

1. **Forward Patterns** (checked first, more specific):
   ```javascript
   /-{3,}\s*Forwarded message\s*-{3,}/i
   /Begin forwarded message:/i
   /^From:\s+.+\n(Sent|Date):\s+/im
   /^Original Message\s*-+/im
   /From:\s+.+\nSent:\s+/i
   /From:\s+.+\nDate:\s+/i
   ```
   - If any pattern matches → **Returns `'forward'`**

2. **Reply Patterns**:
   ```javascript
   /On\s+.+?,\s+.+?\s*<[^>]+>\s*wrote:/i  // "On date, name <email> wrote:"
   /On\s+.+?,\s+.+?\s+wrote:/i             // "On date, name wrote:"
   ```
   - If any pattern matches → **Returns `'reply'`**

### PRIORITY 3: DOM Structure Analysis
Checks for quoted content blocks:

1. **Find quoted content** (`div.gmail_quote`, `blockquote`)
2. **Analyze quote text**:
   - If contains forward headers (`"Forwarded message"`, `"Original Message"`, `"From: ... Sent:"`) AND does NOT contain `"wrote:"` → **Returns `'forward'`**
   - If contains `"wrote:"` → **Returns `'reply'`**

### PRIORITY 4: Subject Line (Least Reliable)
Checks the email subject field:

1. **Forward patterns** (checked first):
   - Subject starts with `"Fwd:"` or `"Fwd"` → **Returns `'forward'`**

2. **Reply patterns**:
   - Subject starts with `"Re:"` → **Returns `'reply'`**

### Default
If none of the above match → **Returns `'new'`** (new email)

## Flow After Detection

### 1. Reply Flow (`isReply === true`)
**Location**: Line ~3111

```javascript
// REPLY: Use existing classification flow
const classification = await classifyEmail(richContext, sourceMessageText, platform, threadHistoryText, senderName);
await generateDraftsWithTone(...);
```

**Process**:
1. Extracts the **specific email being replied to** (not the latest, but the one user clicked Reply on)
2. Extracts **thread history** (all other emails in thread, excluding the one being replied to)
3. Calls `classifyEmail()` to determine package type (sales, jobseeker, etc.)
4. Calls `generateDraftsWithTone()` to generate reply drafts
5. Uses `/generate-drafts-reply` API endpoint

### 2. Forward Flow (`isForward === true`)
**Location**: Line ~2812

```javascript
// Forward is treated as New Email with forwarded message as context
if (isForward || !isReply) {
    // Extract compose window content
    // Remove forwarded message content to get only user's typed content
    // Determine type from typed content
    // Generate drafts for new email
}
```

**Process**:
1. Extracts **forwarded message content** (for context only)
2. Extracts **user's typed content** (removes forwarded message from compose box)
3. Treats as **New Email** generation
4. Determines package type from user's typed content using `/classify-draft-type`
5. Uses `/generate-drafts-draft` API endpoint

### 3. New Email Flow (`!isReply && !isForward`)
**Location**: Line ~2812

```javascript
// NEW EMAIL: Extract compose window content and generate drafts
if (isForward || !isReply) {
    // Extract compose window content
    // Determine type from typed content (if available)
    // Generate drafts for new email
}
```

**Process**:
1. Extracts **compose body text** (user's typed content)
2. Extracts **subject** and **recipient** from compose window
3. If user has typed content → Determines package type using `/classify-draft-type`
4. If no typed content → Uses default role
5. Uses `/generate-drafts-draft` API endpoint

## Key Differences

| Action Type | Source Content | Classification Method | API Endpoint |
|------------|----------------|---------------------|--------------|
| **Reply** | Email being replied to | `/classify-email-type` (classifies the received email) | `/generate-drafts-reply` |
| **Forward** | User's typed content (forwarded message excluded) | `/classify-draft-type` (classifies what user is drafting) | `/generate-drafts-draft` |
| **New Email** | User's typed content | `/classify-draft-type` (classifies what user is drafting) | `/generate-drafts-draft` |

## Important Notes

1. **Reply Detection is Most Reliable**: Uses Gmail's native attribution elements (`.gmail_attr` with `"wrote:"`)

2. **Forward is Treated as New Email**: Forwards use the same flow as new emails, but the forwarded message is extracted for context

3. **Thread History Handling**:
   - For **replies**: Thread history excludes the email being replied to
   - For **new emails/forwards**: No thread history (or empty)

4. **Content Extraction**:
   - **Reply**: Uses `sourceMessageText` (the specific email being replied to)
   - **Forward/New**: Uses `composeBodyText` (user's typed content in compose box)

5. **Classification**:
   - **Reply**: Classifies the **received email** to determine package
   - **Forward/New**: Classifies the **user's draft content** to determine package

## Example Scenarios

### Scenario 1: User clicks "Reply" on an email
1. `detectComposeAction()` finds `.gmail_attr` with "wrote:" → Returns `'reply'`
2. Extracts the email being replied to
3. Calls `/classify-email-type` with that email content
4. Generates reply drafts using `/generate-drafts-reply`

### Scenario 2: User clicks "Forward" on an email
1. `detectComposeAction()` finds "Forwarded message" pattern → Returns `'forward'`
2. Extracts forwarded message content (for context)
3. Extracts user's typed content (excluding forwarded message)
4. Calls `/classify-draft-type` with user's typed content
5. Generates new email drafts using `/generate-drafts-draft`

### Scenario 3: User clicks "Compose" (new email)
1. `detectComposeAction()` finds no reply/forward indicators → Returns `'new'`
2. Extracts user's typed content from compose box
3. Calls `/classify-draft-type` with user's typed content (if any)
4. Generates new email drafts using `/generate-drafts-draft`
