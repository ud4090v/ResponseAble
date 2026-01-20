# xRepl.ai Chrome Extension - Functional Specifications Document

**Version:** 5.0.4  
**Last Updated:** January 2025  
**Document Type:** Functional Specifications & User Acceptance Testing Scenarios

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Core Features](#core-features)
4. [Platform Support](#platform-support)
5. [Subscription Plans & Feature Matrix](#subscription-plans--feature-matrix)
6. [User Interface Specifications](#user-interface-specifications)
7. [Functional Requirements](#functional-requirements)
8. [Technical Architecture](#technical-architecture)
9. [API Integration](#api-integration)
10. [Configuration & Settings](#configuration--settings)
11. [User Acceptance Testing Scenarios](#user-acceptance-testing-scenarios)

---

## Executive Summary

xRepl.ai is a Chrome browser extension that provides AI-powered email draft generation for Gmail and LinkedIn messaging. The extension analyzes email context, classifies email types, determines response strategies, and generates multiple personalized draft options in real-time.

**Key Value Propositions:**
- Context-aware email analysis and classification
- Multiple draft variants with different tones and strategies
- Native integration with Gmail and LinkedIn
- Real-time streaming draft generation
- Specialized packages for different professional roles
- Style mimicking for personalized responses
- Privacy-first analytics (local storage)

---

## Product Overview

### Purpose
xRepl.ai helps professionals draft smart, personalized email replies and new messages faster while maintaining authenticity and building better professional relationships.

### Target Users
- Sales professionals
- Recruiters and hiring managers
- Job seekers
- Customer support teams
- Networking professionals
- General business professionals

### Key Differentiators
1. **Context-Aware Analysis**: Understands full conversation history, not just the last message
2. **Multiple Options**: Always provides choices (2-5 variants depending on plan)
3. **Native Integration**: Works directly in Gmail/LinkedIn compose windows
4. **Real-Time Streaming**: Drafts appear as they're generated
5. **Role-Specific Packages**: Specialized prompts for different professions
6. **Style Learning**: Mimics user's writing voice (Pro+ plans)
7. **Privacy-First**: Analytics stored locally, no cloud data collection

---

## Core Features

### 1. Email Classification System

#### 1.1 Semantic Context Determination
- **Function**: Analyzes email content to determine semantic context and intent
- **Process**:
  1. Extracts email content, subject, recipient information
  2. Calls `/classify-email-type` API endpoint
  3. Matches against available packages (sales, recruitment, jobseeker, support, networking, generic)
  4. Returns matched type with confidence score
  5. Falls back to base (generic) package if confidence < threshold (default 0.85)

#### 1.2 Response Strategy Analysis
- **Function**: Determines optimal response strategies based on email context
- **Process**:
  1. Analyzes email intent and goals
  2. Calls `/determine-goals-reply` or `/determine-goals-draft` API
  3. Returns 1-5 response goals (e.g., "Follow-up", "Value insight", "Objection handler")
  4. Each goal has associated variant sets and tone options
  5. Goals are limited based on subscription plan (1-5 goals)

#### 1.3 Tone Selection
- **Function**: Determines appropriate tone(s) for the response
- **Process**:
  1. Analyzes email context and relationship dynamics
  2. Calls `/determine-tones-reply` or `/determine-tones-draft-specific` API
  3. Returns primary tone and tone sets per goal
  4. Supports 2-5 tones per goal (plan-dependent)
  5. Tones include: Professional, Friendly, Warm, Empathetic, Confident, etc.

### 2. Draft Generation

#### 2.1 Reply Draft Generation
- **Trigger**: User clicks "Respond" button in Gmail/LinkedIn reply compose window
- **Process**:
  1. Detects compose action (Reply vs Forward vs New Email)
  2. Extracts email being replied to and thread history
  3. Shows progress overlay with 4 steps
  4. Classifies email type (Step 1)
  5. Determines response strategies (Step 2)
  6. Selects optimal tones (Step 3)
  7. Generates drafts via `/generate-drafts-reply` API (Step 4)
  8. Streams drafts in real-time
  9. Displays final drafts overlay with variants

#### 2.2 New Email Draft Generation
- **Trigger**: User clicks "Generate" button in Gmail/LinkedIn new message compose window
- **Process**:
  1. Detects new email compose action
  2. Extracts typed content, subject, recipient
  3. Shows progress overlay
  4. Classifies draft type from typed content (Step 1)
  5. Determines goals based on user intent (Step 2)
  6. Selects tones (Step 3)
  7. Generates drafts via `/generate-drafts-draft` API (Step 4)
  8. Streams and displays drafts

#### 2.3 Forward Draft Generation
- **Trigger**: User clicks "Generate" button in forward compose window
- **Process**: Treated as new email with forwarded message as context

#### 2.4 LinkedIn Comment Generation
- **Trigger**: User clicks comment button in LinkedIn post
- **Process**:
  1. Extracts post content
  2. Generates comment via `/generate-drafts-comment` API
  3. Displays single comment draft
  4. Inserts directly into comment field

### 3. Progress Overlay System

#### 3.1 Visual Feedback
- **Appearance**: Modal overlay with 4 sequential steps
- **Steps**:
  1. **Determining Semantic Context...** - Shows detected email type
  2. **Analyzing strategies...** - Shows response goal chips
  3. **Selecting optimal tones...** - Shows tone chips
  4. **Generating drafts...** - Active during draft generation

#### 3.2 Step States
- **Pending**: Gray background, ○ icon
- **Active**: Blue background (#e8f0fe), spinner icon
- **Completed**: Green background (#e6f4ea), ✓ checkmark

#### 3.3 User Interaction
- Cancel button to close overlay
- Escape key to close overlay
- Auto-removed when streaming starts or on error

### 4. Drafts Overlay

#### 4.1 Display Features
- **Title**: "Smart Replies, Instantly" (replies) or "Smart Drafts, Instantly" (new emails)
- **Package Information**: Shows matched type and description
- **Intent Display**: Shows detected intent and key topics
- **Goal Tabs**: Multiple tabs for different response goals (if >1 goal)
- **Variant Display**: Shows 2-5 draft variants per goal
- **Tone Selector**: Dropdown to change tone (Pro+ plans)
- **Insert Button**: One-click insert into compose window

#### 4.2 Draft Variants
- Each variant has unique label (Variant 1, Variant 2, etc.)
- Variants differ in style, length, approach
- User can select preferred variant
- Variants respect configured numVariants setting

#### 4.3 Regeneration
- **Tone Change**: Regenerate with different tone
- **Goal Switch**: Switch between goals (if multiple)
- **Full Regenerate**: Regenerate all drafts with same settings

### 5. Compose Action Detection

#### 5.1 Multi-Factor Detection
- **Priority 1**: Attribution line check (`.gmail_attr` with "wrote:")
- **Priority 2**: Content pattern analysis (forward headers, reply indicators)
- **Priority 3**: DOM structure analysis (quoted content presence)
- **Priority 4**: Subject line analysis ("Re:", "Fwd:")
- **Result**: Returns 'reply', 'forward', or 'new'

#### 5.2 Platform-Specific Detection
- **Gmail**: Uses Gmail-specific DOM selectors and patterns
- **LinkedIn**: Uses LinkedIn-specific DOM structure

### 6. Style Mimicking (Pro+ Plans)

#### 6.1 Style Analysis
- Analyzes user's past emails to learn writing style
- Extracts patterns: sentence length, formality, vocabulary, structure
- Stores style profile locally

#### 6.2 Style Application
- Applies learned style to generated drafts
- Maintains user's authentic voice
- Updates style profile continuously

### 7. Analytics & Metrics

#### 7.1 Local Analytics
- Drafts generated count
- Drafts inserted count
- Thumbs up/down feedback
- Top role usage
- All data stored in Chrome local storage

#### 7.2 Privacy
- No cloud data collection
- 100% local storage
- No tracking or external analytics

---

## Platform Support

### Gmail Integration
- **Supported Actions**: Reply, Forward, New Email
- **Compose Window Detection**: Automatic
- **Button Placement**: Gmail compose toolbar
- **Thread History**: Full thread context extraction
- **Email Details**: Subject, sender, recipients, body extraction

### LinkedIn Integration
- **Supported Actions**: Reply, New Message, Comment
- **Compose Window Detection**: Automatic
- **Button Placement**: LinkedIn message compose area
- **Thread History**: Conversation history extraction
- **Comment Support**: Post comment generation

### Browser Requirements
- Chrome browser (Manifest V3)
- Active internet connection
- Valid API keys (OpenAI or xAI Grok)

---

## Subscription Plans & Feature Matrix

### Free Plan
- **Monthly Limit**: 30 drafts
- **Goals**: 1 goal per email
- **Variants**: 2 variants per goal
- **Tones**: 2 tones per goal
- **Models**: GPT-4o-mini only
- **Packages**: Generic only
- **Style Mimicking**: ❌
- **Price**: $0/month

### Basic Plan
- **Monthly Limit**: 200 drafts
- **Goals**: 3 goals per email
- **Variants**: 3 variants per goal
- **Tones**: 3 tones per goal
- **Models**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo, Grok-4-fast
- **Packages**: Generic only
- **Style Mimicking**: ❌
- **Price**: $9/month ($7.50/month annual)

### Pro Plan
- **Monthly Limit**: Unlimited
- **Goals**: 5 goals per email
- **Variants**: 5 variants per goal
- **Tones**: 5 tones per goal
- **Models**: All OpenAI + Grok models
- **Packages**: 1 included, add more for $15 each
- **Style Mimicking**: ✅
- **Price**: $29/month ($24/month annual)

### Ultimate Plan
- **Monthly Limit**: Unlimited
- **Goals**: 5 goals per email
- **Variants**: 5 variants per goal
- **Tones**: 5 tones per goal
- **Models**: All OpenAI + Grok models
- **Packages**: All packages included
- **Style Mimicking**: ✅
- **Price**: $49/month ($41/month annual)

---

## User Interface Specifications

### 1. Generate Button
- **Location**: Gmail/LinkedIn compose toolbar
- **Appearance**: "xReplAI" text with icon
- **States**:
  - Default: "xReplAI" or "Respond" (replies) / "Forward" (forwards)
  - Working: "Working..." / "Analyzing..." / "Generating..."
  - Disabled: During generation (opacity 0.7)

### 2. Progress Overlay
- **Size**: 80% width, max 600px, max 90vh height
- **Position**: Centered (50% top/left)
- **Z-index**: 2147483647 (highest)
- **Background**: White with rounded corners (12px)
- **Font**: Google Sans, Roboto, sans-serif
- **Animation**: Spinner, fade-in, pulse

### 3. Drafts Overlay
- **Size**: Responsive, max 90vh height
- **Position**: Centered modal
- **Scrollable**: Draft content area
- **Close**: X button, Escape key, click outside

### 4. Color Scheme
- **Primary Blue**: #5567b9 (xRepl.ai brand)
- **Active Blue**: #e8f0fe (active steps)
- **Completed Green**: #e6f4ea (completed steps)
- **Text Gray**: #5f6368 (secondary text)
- **Goal Chips**: Blue background (#e8f0fe), blue text (#1967d2)
- **Tone Chips**: Blue background (#e8f0fe), blue text (#1967d2)

---

## Functional Requirements

### FR1: Email Classification
- **REQ-1.1**: Extension must classify emails into one of: sales, recruitment, jobseeker, support, networking, or generic
- **REQ-1.2**: Classification must be based solely on the email being replied to, not thread history
- **REQ-1.3**: Classification confidence must meet threshold (default 0.85) or fall back to generic
- **REQ-1.4**: Classification must work for both Gmail and LinkedIn

### FR2: Draft Generation
- **REQ-2.1**: Extension must generate 2-5 draft variants based on subscription plan
- **REQ-2.2**: Drafts must be generated in real-time via streaming API
- **REQ-2.3**: Drafts must respect configured numVariants, numGoals, numTones settings
- **REQ-2.4**: Drafts must be contextually appropriate for the email type
- **REQ-2.5**: Drafts must be insertable into compose window with one click

### FR3: Compose Action Detection
- **REQ-3.1**: Extension must correctly detect Reply, Forward, or New Email
- **REQ-3.2**: Detection must work for multiple open compose windows
- **REQ-3.3**: Detection must be accurate for both Gmail and LinkedIn

### FR4: Progress Feedback
- **REQ-4.1**: Progress overlay must appear immediately on button click
- **REQ-4.2**: Progress steps must update in real-time as each step completes
- **REQ-4.3**: Progress overlay must be dismissible (Cancel button, Escape key)
- **REQ-4.4**: Progress overlay must be removed when streaming starts or on error

### FR5: Subscription Plan Enforcement
- **REQ-5.1**: Extension must enforce monthly draft limits per plan
- **REQ-5.2**: Extension must limit goals, variants, tones based on plan
- **REQ-5.3**: Extension must restrict packages based on plan
- **REQ-5.4**: Extension must restrict models based on plan

### FR6: Style Mimicking
- **REQ-6.1**: Style analysis must run in background (non-blocking)
- **REQ-6.2**: Style profile must be stored locally
- **REQ-6.3**: Style must be applied to generated drafts (Pro+ only)

### FR7: Error Handling
- **REQ-7.1**: Extension must handle API errors gracefully
- **REQ-7.2**: Extension must show user-friendly error messages
- **REQ-7.3**: Extension must recover from network errors
- **REQ-7.4**: Extension must handle missing API keys

---

## Technical Architecture

### Components
1. **Content Script** (`contentScript.bundle.js`): Main extension logic
2. **Background Service Worker** (`background.bundle.js`): Background tasks
3. **Options Page**: Settings and configuration
4. **Popup**: Quick access (if implemented)

### Data Storage
- **Chrome Storage API**: Settings, API keys, subscription info, analytics
- **Local Storage**: Style profiles, cached data

### API Endpoints
- `/classify-email-type`: Email type classification
- `/determine-goals-reply`: Response goals for replies
- `/determine-goals-draft`: Response goals for new emails
- `/determine-goals-generic`: Generic goals for base package
- `/determine-tones-reply`: Tone selection for replies
- `/determine-tones-draft-specific`: Tone selection for new emails
- `/generate-drafts-reply`: Draft generation for replies
- `/generate-drafts-draft`: Draft generation for new emails
- `/generate-drafts-comment`: Comment generation for LinkedIn
- `/analyze-style`: Writing style analysis

### Streaming
- **Protocol**: Server-Sent Events (SSE) or streaming JSON
- **Format**: Chunks separated by `|||RESPONSE_VARIANT|||`
- **Parsing**: Real-time parsing and display

---

## API Integration

### Authentication
- API keys stored in Chrome storage
- Keys passed in request headers
- Support for OpenAI and xAI Grok providers

### Request Format
- **Method**: POST
- **Content-Type**: application/json
- **Body**: JSON with email content, context, settings

### Response Format
- **Streaming**: Chunked responses with separators
- **Final**: Complete JSON object with all drafts

### Error Handling
- HTTP status code checking
- Error message extraction
- Fallback to default values on error

---

## Configuration & Settings

### User Settings
- **API Provider**: OpenAI or xAI Grok
- **API Model**: Model selection based on provider
- **API Key**: Secure storage in Chrome storage
- **Number of Variants**: 2-5 (plan-dependent)
- **Number of Goals**: 1-5 (plan-dependent)
- **Number of Tones**: 2-5 (plan-dependent)
- **Classification Confidence Threshold**: 0.0-1.0 (default 0.85)
- **Style Mimicking**: Enable/disable (Pro+ only)
- **Selected Packages**: Package selection (Pro+ only)
- **Default Role**: Default package for new emails

### Plan Settings
- Automatically enforced based on subscription tier
- Cannot exceed plan limits
- Settings UI shows plan-appropriate options only

---

## User Acceptance Testing Scenarios

See [UAT_TEST_SCENARIOS.md](./UAT_TEST_SCENARIOS.md) for comprehensive test scenarios.

---

## Appendix

### A. Package Definitions
- **Sales**: Product/service sales, deals, negotiations
- **Recruitment**: Recruiter reaching out to candidates
- **Jobseeker**: Job seeker applying or following up
- **Support**: Customer support issues and resolutions
- **Networking**: Professional connections and referrals
- **Generic**: General professional emails

### B. Supported Models
- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **xAI Grok**: grok-2-vision-1212, grok-2-1212, grok-beta, grok-4-latest, grok-4-fast

### C. Browser Compatibility
- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

---

**Document End**
