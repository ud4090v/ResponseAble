# Email Type Determination for New Email Drafts - Complete Walkthrough

**Date**: 2026-01-22  
**Purpose**: Document how the extension determines email type when drafting a new email

---

## Overview

When a user clicks "Generate" on a **new email** (not a reply), the extension must determine which content package to use (sales, recruitment, jobseeker, support, networking, or generic). This walkthrough explains the complete flow from user action to package selection.

---

## Flow Diagram

```
User clicks "Generate" on new email
    ↓
detectComposeAction() → Returns 'new'
    ↓
Extract compose window content (subject, recipient, body text)
    ↓
Has user typed content? (subject OR body)
    ├─ NO → Use defaultRole from settings
    │        ↓
    │        Generate with defaultRole
    │
    └─ YES → Call /classify-draft-type API
             ↓
             Check confidence threshold (default: 0.85)
             ↓
             Is confidence >= threshold AND type in user's packages?
             ├─ YES → Use determined type
             │        ↓
             │        Generate with determined type
             │
             └─ NO → Fallback to base package
                      ↓
                      Generate generic single draft
```

---

## Step-by-Step Process

### Step 1: Action Detection

**Location**: `src/pages/Content/index.jsx` - Line ~2690

```javascript
// Use multi-factor detection to determine compose action type
let composeAction = 'new';
if (adapter.detectComposeAction) {
    composeAction = adapter.detectComposeAction();
} else {
    // Fallback to old method
    if (adapter.isReply && adapter.isReply()) {
        composeAction = 'reply';
    } else if (adapter.isForward && adapter.isForward()) {
        composeAction = 'forward';
    }
}

const isReply = composeAction === 'reply';
const isForward = composeAction === 'forward';
```

**For new emails**: `composeAction === 'new'` (no reply/forward indicators found)

---

### Step 2: Extract Compose Window Content

**Location**: `src/pages/Content/index.jsx` - Line ~2812

```javascript
// NEW EMAIL: Extract compose window content and generate drafts
if (isForward || !isReply) {
    // Extract compose window content
    const composeBodyText = adapter.getComposeBodyText();
    const composeSubject = adapter.getComposeSubject();
    const composeRecipient = adapter.getComposeRecipient();
    
    // ... type determination logic ...
}
```

**Extracted Data**:
- `composeBodyText`: User's typed email body content
- `composeSubject`: Email subject line
- `composeRecipient`: Recipient email address

---

### Step 3: Check for Typed Content

**Location**: `src/pages/Content/index.jsx` - Line ~2905

```javascript
if (composeBodyText.trim().length > 0 || composeSubject.trim().length > 0) {
    // User has typed content - determine type from it
    // ... classification logic ...
} else {
    // No typed content - use default role
    selectedRole = defaultRole;
}
```

**Decision Point**:
- **Has content**: Proceed to type determination
- **No content**: Use `defaultRole` from user settings (no API call needed)

---

### Step 4: Call Classification API (If Content Exists)

**Location**: `src/pages/Content/index.jsx` - Line ~2918

**API Endpoint**: `POST /api/classify-draft-type`

**Request Payload**:
```javascript
{
    typedContent: composeBodyText,           // User's typed email body
    subject: composeSubject,                 // Email subject (optional)
    recipient: composeRecipient,             // Recipient email (optional)
    availablePackages: userPackages,          // User's enabled packages
    confidenceThreshold: 0.85,                // Default: 0.85
    provider: apiConfig.provider,             // 'openai' or 'grok'
    model: classificationModel                // 'gpt-4o-mini' or 'grok-4-fast'
}
```

**What `userPackages` Contains**:
- Array of package objects the user has enabled
- Always includes base package (generic)
- Each package has: `name`, `description`, `userIntent`, `roleDescription`, `contextSpecific`, `base` (boolean)

---

### Step 5: Backend Classification Process

**Backend File**: `api/classify-draft-type.js`

#### 5.1 Build Classification Prompt

**Location**: `prompts/classification.js` - Line 58

The prompt instructs the LLM to:
1. Analyze the user's typed content (what they're drafting)
2. Match it to one of the available packages
3. Return JSON with:
   - `matched_type`: Full package object (name, description, userIntent, roleDescription, contextSpecific)
   - `confidence`: 0.0 to 1.0
   - `reason`: Brief explanation

**Key Prompt Instructions**:
```
- Match based on what YOU (the user) are drafting in the email content
- Use the description and userIntent to determine which package matches YOUR role
- Only choose from the listed packages above
```

#### 5.2 LLM Call

**Model**: 
- OpenAI: `gpt-4o-mini` (fast, cheap)
- Grok: `grok-4-fast` (fast, cheap)

**Parameters**:
- `temperature: 0.3` (low for consistent classification)
- `max_tokens: 800`

#### 5.3 Parse Response

**Response Format**:
```json
{
    "matched_type": {
        "name": "sales",
        "description": "Sales outreach and follow-up emails",
        "userIntent": "Selling products or services",
        "roleDescription": "Sales professional",
        "contextSpecific": "Outreach, follow-ups, proposals"
    },
    "confidence": 0.92,
    "reason": "User is drafting a sales outreach email to a potential customer"
}
```

---

### Step 6: Frontend Validation & Package Selection

**Location**: `src/pages/Content/index.jsx` - Line ~2939

#### 6.1 Extract Matched Type

```javascript
const typeResult = await response.json();
const matchedTypeData = typeResult.matched_type;
const determinedTypeName = matchedTypeData?.name || null;
```

#### 6.2 Check Confidence Threshold

```javascript
const confidence = typeResult.confidence !== undefined ? typeResult.confidence : 0;
const minConfidence = apiConfig.classificationConfidenceThreshold || 0.85;
const isLowConfidence = confidence < minConfidence;
```

**Default threshold**: `0.85` (85% confidence required)

#### 6.3 Validate Package Availability

```javascript
if (!determinedTypeName || isLowConfidence) {
    // Fallback to base package
    selectedRole = getBasePackageName();
    shouldUseGenericSingleDraft = true;
} else {
    // Check if determined type is in user's packages
    const determinedPackage = userPackages.find(p => p.name === determinedTypeName);
    if (determinedPackage) {
        // Type matches user package - use it
        selectedRole = determinedTypeName;
    } else {
        // Type doesn't match any user package - use base package
        selectedRole = getBasePackageName();
        shouldUseGenericSingleDraft = true;
    }
}
```

**Decision Logic**:
1. **No type determined OR low confidence** → Base package (generic)
2. **Type determined AND in user's packages** → Use determined type
3. **Type determined BUT not in user's packages** → Base package (generic)

**Important**: The extension does NOT auto-update `defaultRole` in settings. The determined type is only used for this specific draft generation.

---

### Step 7: Generate Drafts

**Location**: `src/pages/Content/index.jsx` - Line ~3010

#### 7.1 Generic Single Draft (Fallback)

If `shouldUseGenericSingleDraft === true`:
```javascript
await generateGenericSingleDraft(
    richContext,
    platform,
    composeSubject,
    composeRecipient,
    composeBodyText,
    actualRecipientName,
    recipientCompany,
    adapter,
    userAccountName,
    userAccountEmail,
    callback
);
```

**API Endpoint**: `/generate-drafts-draft` (generic mode)

**How Generic Drafts Are Generated**:

When falling back to generic, the draft generation uses **BOTH** the user's typed content AND the generic package's metadata:

1. **User's Typed Content** (PRIMARY BASIS):
   - Sent as `typedContent` parameter
   - Includes: subject, recipient, and body text
   - Prompt instruction: *"CRITICAL: The drafts MUST be based on and incorporate the typed content above. Use the typed content as the foundation for your email drafts, expanding and refining it according to the variant strategies."*

2. **Generic Package Metadata** (CONTEXT FRAMEWORK):
   - `userIntent`: Generic package's userIntent (e.g., "General communication")
   - `roleDescription`: Generic package's roleDescription (e.g., "Professional communicator")
   - `contextSpecific`: Generic package's contextSpecific (e.g., "General purpose emails")
   - These provide the role/context framework for how to expand the typed content

**Result**: The LLM uses the user's typed content as the foundation and expands/refines it using the generic package's role and context guidelines. The typed content is the primary driver, while the package metadata provides the framework for expansion.

#### 7.2 Package-Specific Drafts (Normal Flow)

If `shouldUseGenericSingleDraft === false`:
```javascript
await generateDraftsForNewEmail(
    richContext,
    platform,
    selectedRole,  // Determined type (e.g., "sales")
    actualRecipientName,
    recipientCompany,
    adapter,
    userAccountName,
    userAccountEmail,
    composeSubject,
    composeBodyText,
    composeRecipient,
    callback,
    onProgress
);
```

**API Endpoint**: `/generate-drafts-draft` (with package-specific prompts)

**How Package-Specific Drafts Are Generated**:

Similar to generic, but uses the determined package's metadata instead:
- Uses the determined package's `userIntent`, `roleDescription`, and `contextSpecific`
- Still uses user's typed content as the primary basis
- Package metadata provides more specific context (e.g., sales outreach vs. job application)

---

## Key Differences: New Email vs Reply

| Aspect | New Email | Reply |
|--------|-----------|-------|
| **API Endpoint** | `/classify-draft-type` | `/classify-email-type` |
| **Input Content** | User's typed draft content | Email being replied to |
| **Classification Focus** | What the user is drafting | What the sender is asking |
| **Prompt Instruction** | "Match based on what YOU are drafting" | "Match based on what the sender is asking" |
| **Context** | Subject, recipient, typed body | Email content, sender name, company, subject |
| **Thread History** | Not used | Used for context (but not for classification) |

---

## Example Scenarios

### Scenario 1: User Types Sales Email

**User Action**:
- Opens new email compose window
- Types: "Hi John, I wanted to reach out about our new product..."
- Clicks "Generate"

**Flow**:
1. `detectComposeAction()` → `'new'`
2. Extracts: `composeBodyText = "Hi John, I wanted to reach out..."`
3. Calls `/classify-draft-type` with typed content
4. LLM analyzes: "User is drafting a sales outreach email"
5. Returns: `matched_type: { name: "sales", ... }, confidence: 0.92`
6. Checks: `confidence (0.92) >= threshold (0.85)` ✅
7. Checks: `"sales" in userPackages` ✅
8. Uses `selectedRole = "sales"`
9. Generates drafts using sales package prompts

---

### Scenario 2: User Types Job Application Email

**User Action**:
- Opens new email compose window
- Types: "Dear Hiring Manager, I am writing to apply for..."
- Clicks "Generate"

**Flow**:
1. `detectComposeAction()` → `'new'`
2. Extracts: `composeBodyText = "Dear Hiring Manager..."`
3. Calls `/classify-draft-type` with typed content
4. LLM analyzes: "User is drafting a job application email"
5. Returns: `matched_type: { name: "jobseeker", ... }, confidence: 0.88`
6. Checks: `confidence (0.88) >= threshold (0.85)` ✅
7. Checks: `"jobseeker" in userPackages` ✅
8. Uses `selectedRole = "jobseeker"`
9. Generates drafts using jobseeker package prompts

---

### Scenario 3: User Types Ambiguous Content

**User Action**:
- Opens new email compose window
- Types: "Hi, how are you?"
- Clicks "Generate"

**Flow**:
1. `detectComposeAction()` → `'new'`
2. Extracts: `composeBodyText = "Hi, how are you?"`
3. Calls `/classify-draft-type` with typed content
4. LLM analyzes: "Content is too generic, cannot determine type"
5. Returns: `matched_type: { name: "generic", ... }, confidence: 0.45`
6. Checks: `confidence (0.45) < threshold (0.85)` ❌
7. Falls back to base package
8. Uses `selectedRole = "generic"` (base package)
9. Generates generic single draft

---

### Scenario 4: User Has No Typed Content

**User Action**:
- Opens new email compose window
- Does NOT type anything
- Clicks "Generate"

**Flow**:
1. `detectComposeAction()` → `'new'`
2. Extracts: `composeBodyText = ""`, `composeSubject = ""`
3. Checks: `composeBodyText.trim().length === 0 && composeSubject.trim().length === 0` ✅
4. **Skips API call** (no classification needed)
5. Uses `selectedRole = defaultRole` (from user settings)
6. Generates drafts using default role

---

## Configuration Options

### Confidence Threshold

**Location**: User settings (Options page)

**Default**: `0.85` (85%)

**Effect**: 
- Higher threshold → More strict classification (more fallbacks to generic)
- Lower threshold → More lenient classification (more type matches)

**Code Location**: `apiConfig.classificationConfidenceThreshold`

---

### Available Packages

**Location**: User settings (Options page) - "Email Type Packages" section

**Effect**: 
- Only packages selected here are available for classification
- If LLM determines a type not in this list → Falls back to base package
- Base package is always included (cannot be disabled)

**Code Location**: `getUserPackages()` function

---

## Error Handling

### API Call Fails

**Location**: `src/pages/Content/index.jsx` - Line ~2978

```javascript
catch (typeError) {
    console.error('Error determining type from content:', typeError);
    // Fallback to default role
    selectedRole = defaultRole;
    // Still report type progress with fallback
    if (onProgress) {
        onProgress({
            step: 'type',
            data: {
                type: selectedRole,
                confidence: 0
            }
        });
    }
}
```

**Behavior**: Falls back to `defaultRole` from settings, continues with draft generation

---

### Invalid Response from API

**Backend Location**: `api/classify-draft-type.js` - Line ~84

```javascript
catch (parseError) {
    // Fallback to base package if parsing fails
    const basePackage = availablePackages.find(p => p.base) || availablePackages[0];
    return res.status(200).json({
        matched_type: basePackage,
        confidence: 1.0,
        reason: 'Type determination failed, using base package fallback'
    });
}
```

**Behavior**: Returns base package with `confidence: 1.0`, frontend treats as valid response

---

## Performance Considerations

### Model Selection

**Classification Models** (fast, cheap):
- OpenAI: `gpt-4o-mini`
- Grok: `grok-4-fast`

**Draft Generation Models** (slower, more expensive):
- OpenAI: `gpt-4o` or `gpt-4-turbo`
- Grok: `grok-4-latest`

**Rationale**: Classification doesn't need high-quality text generation, just accurate categorization.

---

### Caching

**Current Implementation**: No caching

**Potential Optimization**: Cache classification results for identical content (subject + body) within the same session.

---

## Troubleshooting

### Issue: Always Falls Back to Generic

**Possible Causes**:
1. Confidence threshold too high
2. User's typed content too ambiguous
3. Determined type not in user's enabled packages
4. API returning low confidence

**Debug Steps**:
1. Check console logs for `typeResult` object
2. Verify `confidence` value
3. Check if `determinedTypeName` is in `userPackages`
4. Lower confidence threshold in settings (test)

---

### Issue: Wrong Type Determined

**Possible Causes**:
1. Ambiguous content (could match multiple types)
2. LLM misinterpretation
3. Package descriptions not clear enough

**Debug Steps**:
1. Check `typeResult.reason` in console
2. Review package descriptions in `packages.json`
3. Test with more specific content
4. Adjust confidence threshold

---

### Issue: API Call Fails

**Possible Causes**:
1. Network error
2. API key invalid
3. Rate limiting
4. Backend error

**Debug Steps**:
1. Check browser console for error message
2. Verify API key in settings
3. Check network tab for HTTP status code
4. Review backend logs (Vercel)

---

## Related Files

### Frontend
- `src/pages/Content/index.jsx` - Main content script (lines 2905-3004)
- `src/pages/Options/Options.tsx` - Settings UI for packages

### Backend
- `api/classify-draft-type.js` - Classification endpoint
- `prompts/classification.js` - Prompt templates (line 58)

### Configuration
- `config/packages.json` - Package definitions
- `config/apiKeys.js` - API configuration

---

## Summary

The email type determination for new emails follows this process:

1. **Detect** that it's a new email (not reply/forward)
2. **Extract** user's typed content (subject, body, recipient)
3. **Classify** using `/classify-draft-type` API (if content exists)
4. **Validate** confidence threshold and package availability
5. **Generate** drafts using determined type or fallback to generic

The system prioritizes accuracy (confidence threshold) and user control (only uses enabled packages), with graceful fallbacks to ensure drafts are always generated even if classification fails.

---

**Last Updated**: 2026-01-22
