# Development Chat Documentation

This document captures the complete development chat for the ResponseAble
extension workstream. It consolidates the full discussion into a single,
readable log of goals, decisions, issues, fixes, and outcomes.

## Overview

The chat focused on fixing incorrect AI-generated email replies (wrong sender
names, reversed roles, fabricated signatures) and evolving the system to use
AI-based classification for better context detection. Along the way, the UI,
prompting, parsing, and error handling were made more robust, and configuration
was expanded to allow users to control the number of response variants and tone.

## Goals and Requirements

- Correctly identify the sender/recipient and reply from the user's perspective.
- Prevent fabricated signatures or names in replies.
- Improve context detection by replacing heuristic rules with AI classification.
- Use a smaller model for classification and a main model for generation.
- Show classification details and AI recommendations in the overlay UI.
- Add a tone selector and dynamically suggested tones per goal.
- Replace "formal" default tone with "professional".
- Make the number of variants configurable (default 4, max 7).
- Ensure response variants are cleanly separated and labels removed.
- Improve error handling for API failures and malformed JSON.
- Move API keys into a gitignored file for security.

## Timeline of Work (Chat-Driven)

### 1) Incorrect names, reversed roles, fabricated signatures

**Issue**
- Replies used wrong names (e.g., "Prasad"), reversed roles, and fake signatures
  (e.g., "Alex Johnson").

**Fixes**
- Enhanced `getRichContext()` to accurately extract the sender's name from the
  active Gmail thread, not from global UI elements.
- Prompt updates to clarify who is replying to whom.
- Added explicit instructions to forbid fake signatures and invented names.

### 2) "Hi Google" greeting and sender scope issues

**Issue**
- Greetings sometimes used generic platform names like "Google".

**Fixes**
- Scoped sender extraction to the current email thread/compose window.
- Added filters to ignore platform/generic names.

### 3) Context misclassification (reply from wrong perspective)

**Issue**
- Generated replies assumed the sender was the applicant.

**Fixes**
- Prompt wording reinforced the correct perspective.
- Introduced AI-based classification to infer the email type and context.

### 4) Switch from IF-logic to AI classification

**Requirement**
- Use a lightweight AI call for classification, then generate replies with
  role-specific prompts.

**Implementation**
- Added `classifyEmail()` to request structured JSON from a fast model
  (`gpt-4o-mini` or `grok-4-fast`).
- Parsed and validated response fields:
  - `type`, `intent`, `response_goals`, `goal_titles`, `tone_needed`,
    `tone_sets`, `variant_sets`, `recipient_name`, `recipient_company`,
    `key_topics`.
- Built role-specific prompts based on classification and selected goals/tones.

### 5) JSON parsing failures and repair

**Issue**
- API responses sometimes returned truncated or malformed JSON.

**Fixes**
- Added robust JSON cleaning and repair:
  - Strip markdown code blocks.
  - Repair incomplete strings/brackets/arrays.
  - Remove trailing commas.
- Added extensive debug logging to show original and fixed content.
- Increased `max_tokens` for classification to reduce truncation.

### 6) Variant separation and label contamination

**Issue**
- Response variants were merged or had labels appended inside content.

**Fixes**
- Strengthened prompt format rules with "IMPORTANT FORMATTING REQUIREMENTS"
  and explicit example formats (needed for `grok-4-fast`).
- Implemented parsing logic that splits on the required delimiter and removes
  numbering/labels from blocks.
- Reused the same parsing logic on tab switches so regenerated drafts stay clean.

### 7) UI updates: goals, tone selector, debug context

**Requirements**
- Display classification details in overlay.
- Show recommended variant names and tone suggestions.
- Allow tone changes per response goal.

**Implementation**
- Added tabs for `response_goals` with short `goal_titles`.
- Added a goal description block.
- Reintroduced the tone selector with options from `tone_sets[currentGoal]`.
- Marked the first tab as "Recommended".

### 8) Tone defaults updated

**Issue**
- "Formal" appeared in several defaults and UI elements.

**Fixes**
- Replaced "formal" with "professional" as default tone.
- Ensured tone lists use AI-suggested tones rather than fixed options.

### 9) Configurable number of variants

**Requirement**
- Make the number of variants configurable in extension settings.

**Implementation**
- Added `numVariants` to options state and storage.
- Default set to 4, clamped between 1 and 7.
- Applied to classification prompt and generation logic.

### 10) Close button reliability

**Issue**
- Close button handling was unreliable.

**Fix**
- Added a unique ID and updated handlers to target it directly.

### 11) API key refactor and security

**Requirement**
- Move API keys out of source code and into a gitignored file.

**Implementation**
- Added `src/config/apiKeys.js` with empty key placeholders.
- Added `src/config/apiKeys.js` to `.gitignore`.
- Updated content script imports to read keys from this file.
- Added key validation with clear error messages for missing keys.

### 12) Network and API errors

**Issues**
- `HTTP 403` authentication errors.
- `TypeError: Failed to fetch`.
- Error objects logged as `[object Object]`.

**Fixes**
- Added explicit error handling for network failures.
- Added status-specific errors for 401/403/429.
- Improved error logging by stringifying error objects.

### 13) Model-specific behaviors (grok-4-fast)

**Issue**
- `grok-4-fast` occasionally returned a single merged block.

**Fix**
- Re-added explicit example format instructions to enforce separation.

### 14) Git remote update request

**Requirement**
- Switch from boilerplate repo remote to the user's repository.

**Action**
- Provided steps for updating the git remote and pushing to
  `https://github.com/ud4090v/ResponseAble.git`.

## Key Files Touched

- `src/pages/Content/index.jsx`
  - `getRichContext()` improvements for sender extraction.
  - `classifyEmail()` implementation and JSON parsing/repair.
  - Dynamic prompt generation via role-specific templates.
  - Draft parsing logic and UI updates in the overlay.
  - API error handling and key validation.
- `src/pages/Options/Options.tsx`
  - `numVariants` setting with storage persistence and validation.
- `.gitignore`
  - Added `src/config/apiKeys.js`.
- `src/config/apiKeys.js`
  - New gitignored file for API keys.

## Known Issues and Outcomes

- Sender name detection improved and false platform names filtered.
- Response role alignment corrected (reply from user to recruiter).
- Fake signatures eliminated by prompt constraints.
- JSON parsing stabilized with repair logic.
- Variant separation stabilized with strict format and cleanup.
- API key management moved to local, gitignored config.
- Clear error messages implemented for common API and network failures.

## Current State

All major user-reported issues were addressed in the chat:
- Classification works and returns tone suggestions.
- Drafts are generated per goal and per selected tone.
- Variants are cleanly separated.
- API key handling is secure and validated.

No pending tasks were left open in the final state of the chat.
