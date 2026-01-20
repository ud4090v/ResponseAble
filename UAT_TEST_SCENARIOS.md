# xRepl.ai Chrome Extension - User Acceptance Testing Scenarios

**Version:** 5.0.4  
**Last Updated:** January 2025  
**Document Type:** User Acceptance Testing (UAT) Test Scenarios

---

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Installation & Configuration Tests](#installation--configuration-tests)
3. [Gmail Integration Tests](#gmail-integration-tests)
4. [LinkedIn Integration Tests](#linkedin-integration-tests)
5. [Email Classification Tests](#email-classification-tests)
6. [Draft Generation Tests](#draft-generation-tests)
7. [Progress Overlay Tests](#progress-overlay-tests)
8. [Drafts Overlay Tests](#drafts-overlay-tests)
9. [Subscription Plan Tests](#subscription-plan-tests)
10. [Style Mimicking Tests](#style-mimicking-tests)
11. [Error Handling Tests](#error-handling-tests)
12. [Edge Cases & Boundary Tests](#edge-cases--boundary-tests)
13. [Performance Tests](#performance-tests)
14. [Accessibility Tests](#accessibility-tests)
15. [Cross-Browser Tests](#cross-browser-tests)

---

## Test Environment Setup

### Prerequisites
- Chrome browser (latest version)
- Gmail account (test account)
- LinkedIn account (test account)
- Valid API keys (OpenAI or xAI Grok)
- Test email threads (various types)
- Extension build file (`.zip` or unpacked)

### Test Data
- **Sales Emails**: Product inquiries, deal negotiations, follow-ups
- **Recruitment Emails**: Job offers, interview invitations, application follow-ups
- **Jobseeker Emails**: Application submissions, thank-you emails, networking requests
- **Support Emails**: Technical issues, billing questions, feature requests
- **Networking Emails**: Introductions, referral requests, collaboration proposals
- **Generic Emails**: Meeting requests, information sharing, acknowledgments

---

## Installation & Configuration Tests

### TC-INST-001: Extension Installation
**Objective**: Verify extension installs correctly from Chrome Web Store or unpacked

**Steps**:
1. Navigate to Chrome Extensions page (`chrome://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked" or install from Web Store
4. Select extension directory
5. Verify extension appears in extensions list

**Expected Results**:
- ✅ Extension installs without errors
- ✅ Extension icon appears in Chrome toolbar
- ✅ Extension name shows as "xReplAI"
- ✅ Extension version displays correctly (5.0.4)

---

### TC-INST-002: Initial Configuration
**Objective**: Verify user can configure API settings

**Steps**:
1. Click extension icon to open popup/options
2. Navigate to Settings/Options page
3. Enter API provider (OpenAI or xAI Grok)
4. Enter API key
5. Select API model
6. Save settings

**Expected Results**:
- ✅ Settings page loads correctly
- ✅ API provider selection works
- ✅ API key input accepts text (masked)
- ✅ API key saves securely
- ✅ Model dropdown shows appropriate models for selected provider
- ✅ Settings persist after browser restart

---

### TC-INST-003: Subscription Plan Configuration
**Objective**: Verify subscription plan settings are applied correctly

**Steps**:
1. Open Options page
2. Select subscription plan (Free, Basic, Pro, Ultimate)
3. Verify plan-specific limits are displayed
4. Configure numVariants, numGoals, numTones within plan limits
5. Attempt to exceed plan limits

**Expected Results**:
- ✅ Plan selection works
- ✅ Plan limits are displayed correctly
- ✅ Settings respect plan limits (cannot exceed)
- ✅ UI shows appropriate options for selected plan
- ✅ Error message shown if attempting to exceed limits

---

### TC-INST-004: Package Selection
**Objective**: Verify package selection works (Pro+ plans)

**Steps**:
1. Open Options page
2. Navigate to Package Selection
3. Select available packages (sales, recruitment, jobseeker, etc.)
4. Verify selected packages are saved
5. Test with Free/Basic plan (should show generic only)

**Expected Results**:
- ✅ Package selection UI loads
- ✅ Available packages shown based on plan
- ✅ Multiple packages can be selected (Pro+)
- ✅ Selected packages persist
- ✅ Free/Basic plans show generic package only

---

## Gmail Integration Tests

### TC-GMAIL-001: Button Injection in Compose Window
**Objective**: Verify Generate button appears in Gmail compose windows

**Steps**:
1. Open Gmail
2. Click "Compose" to create new email
3. Verify button appears in compose toolbar
4. Click "Reply" on an email
5. Verify button appears in reply compose window
6. Click "Forward" on an email
7. Verify button appears in forward compose window

**Expected Results**:
- ✅ Button appears in all compose windows
- ✅ Button text shows "xReplAI" or context-appropriate text
- ✅ Button is clickable and responsive
- ✅ Button styling matches Gmail interface

---

### TC-GMAIL-002: Reply Detection
**Objective**: Verify extension correctly detects reply action

**Steps**:
1. Open email thread in Gmail
2. Click "Reply" button
3. Verify compose window opens
4. Check extension detects "reply" action
5. Verify button text changes to "Respond"

**Expected Results**:
- ✅ Reply action detected correctly
- ✅ Button text updates to "Respond"
- ✅ Extension extracts email being replied to
- ✅ Thread history extracted correctly

---

### TC-GMAIL-003: Forward Detection
**Objective**: Verify extension correctly detects forward action

**Steps**:
1. Open email in Gmail
2. Click "Forward" button
3. Verify compose window opens
4. Check extension detects "forward" action
5. Verify button text changes to "Forward"

**Expected Results**:
- ✅ Forward action detected correctly
- ✅ Button text updates to "Forward"
- ✅ Forwarded content extracted correctly
- ✅ Extension treats forward as new email with context

---

### TC-GMAIL-004: New Email Detection
**Objective**: Verify extension correctly detects new email compose

**Steps**:
1. Click "Compose" in Gmail
2. Verify compose window opens
3. Check extension detects "new" action
4. Verify button text shows "xReplAI"

**Expected Results**:
- ✅ New email action detected correctly
- ✅ Button text shows default "xReplAI"
- ✅ Extension ready to generate new email drafts

---

### TC-GMAIL-005: Multiple Compose Windows
**Objective**: Verify extension works with multiple open compose windows

**Steps**:
1. Open first compose window (new email)
2. Open second compose window (reply)
3. Verify both windows have Generate buttons
4. Click Generate in first window
5. Verify correct window is used for generation
6. Click Generate in second window
7. Verify correct window is used

**Expected Results**:
- ✅ Each compose window has its own button
- ✅ Button actions are scoped to correct window
- ✅ No interference between windows
- ✅ Drafts insert into correct compose window

---

### TC-GMAIL-006: Thread History Extraction
**Objective**: Verify thread history is extracted correctly for replies

**Steps**:
1. Open email thread with 3+ messages
2. Click Reply on middle message (not latest)
3. Click Generate button
4. Verify extension extracts:
   - Email being replied to (middle message)
   - Previous thread history (excluding replied-to message)
   - Sender information

**Expected Results**:
- ✅ Correct email extracted (the one being replied to)
- ✅ Thread history excludes replied-to email
- ✅ Sender name and email extracted correctly
- ✅ Subject line extracted correctly

---

## LinkedIn Integration Tests

### TC-LINKEDIN-001: Button Injection in Message Compose
**Objective**: Verify Generate button appears in LinkedIn message compose

**Steps**:
1. Navigate to LinkedIn Messaging
2. Open conversation or start new message
3. Verify button appears in message compose area
4. Click button to verify it's functional

**Expected Results**:
- ✅ Button appears in LinkedIn message compose
- ✅ Button is properly styled for LinkedIn
- ✅ Button is clickable
- ✅ Button positioning is correct

---

### TC-LINKEDIN-002: LinkedIn Reply Detection
**Objective**: Verify extension detects LinkedIn message replies

**Steps**:
1. Open LinkedIn conversation
2. Click in reply field
3. Verify extension detects reply action
4. Click Generate button
5. Verify drafts are generated for reply context

**Expected Results**:
- ✅ Reply action detected correctly
- ✅ Conversation history extracted
- ✅ Drafts generated appropriate for reply
- ✅ Drafts insert into LinkedIn message field

---

### TC-LINKEDIN-003: LinkedIn New Message
**Objective**: Verify extension works for new LinkedIn messages

**Steps**:
1. Click "New Message" in LinkedIn
2. Enter recipient name
3. Click in message field
4. Verify extension detects new message
5. Click Generate button
6. Verify drafts are generated

**Expected Results**:
- ✅ New message detected correctly
- ✅ Drafts generated for new message context
- ✅ Drafts insert into LinkedIn message field

---

### TC-LINKEDIN-004: LinkedIn Comment Generation
**Objective**: Verify comment generation works on LinkedIn posts

**Steps**:
1. Navigate to LinkedIn feed
2. Find a post
3. Click comment button (if extension adds one)
4. Verify comment draft is generated
5. Verify comment inserts into comment field

**Expected Results**:
- ✅ Comment button appears (if implemented)
- ✅ Comment draft generated
- ✅ Comment is contextually appropriate
- ✅ Comment inserts into comment field

---

## Email Classification Tests

### TC-CLASS-001: Sales Email Classification
**Objective**: Verify sales emails are classified correctly

**Steps**:
1. Open email about product inquiry or deal negotiation
2. Click Reply
3. Click Generate button
4. Observe progress overlay Step 1
5. Verify classification shows "sales" or "Semantic context: Sales"

**Expected Results**:
- ✅ Email classified as "sales"
- ✅ Confidence score displayed (if shown)
- ✅ Progress overlay shows correct type
- ✅ Appropriate package used for draft generation

---

### TC-CLASS-002: Recruitment Email Classification
**Objective**: Verify recruitment emails are classified correctly

**Steps**:
1. Open email from recruiter offering job position
2. Click Reply
3. Click Generate button
4. Verify classification shows "jobseeker" (from candidate perspective)

**Expected Results**:
- ✅ Email classified as "jobseeker" (user is candidate)
- ✅ Classification based on email being replied to, not thread history
- ✅ Correct package used for generation

---

### TC-CLASS-003: Jobseeker Email Classification
**Objective**: Verify job application emails are classified correctly

**Steps**:
1. Open email from job seeker applying for position
2. Click Reply (as recruiter)
3. Click Generate button
4. Verify classification shows "recruitment" (user is recruiter)

**Expected Results**:
- ✅ Email classified as "recruitment" (user is recruiter)
- ✅ Classification perspective is correct
- ✅ Appropriate package used

---

### TC-CLASS-004: Support Email Classification
**Objective**: Verify support emails are classified correctly

**Steps**:
1. Open email about technical issue or billing question
2. Click Reply
3. Click Generate button
4. Verify classification shows "support"

**Expected Results**:
- ✅ Email classified as "support"
- ✅ Appropriate package used
- ✅ Drafts address support context

---

### TC-CLASS-005: Generic Email Classification
**Objective**: Verify generic emails fall back to generic package

**Steps**:
1. Open email that doesn't fit specific categories
2. Click Reply
3. Click Generate button
4. Verify classification shows "generic" or falls back to generic

**Expected Results**:
- ✅ Email classified as "generic" or base package
- ✅ Fallback works when confidence is low
- ✅ Generic package used for generation

---

### TC-CLASS-006: Low Confidence Classification
**Objective**: Verify low confidence emails fall back to generic

**Steps**:
1. Open ambiguous email
2. Set classification confidence threshold to 0.9
3. Click Reply and Generate
4. Verify fallback to generic if confidence < 0.9

**Expected Results**:
- ✅ Low confidence emails fall back to generic
- ✅ Threshold setting is respected
- ✅ User sees appropriate fallback

---

### TC-CLASS-007: Classification Based on Specific Email
**Objective**: Verify classification uses email being replied to, not thread history

**Steps**:
1. Open email thread with multiple messages
2. Thread starts with sales email, latest is recruitment email
3. Click Reply on the sales email (middle of thread)
4. Click Generate
5. Verify classification is "sales" (not "recruitment")

**Expected Results**:
- ✅ Classification based on specific email being replied to
- ✅ Thread history does not influence classification
- ✅ Correct package used based on replied-to email

---

## Draft Generation Tests

### TC-DRAFT-001: Reply Draft Generation
**Objective**: Verify reply drafts are generated correctly

**Steps**:
1. Open email thread
2. Click Reply
3. Click Generate button
4. Wait for progress overlay to complete
5. Verify drafts overlay appears
6. Verify multiple draft variants are shown

**Expected Results**:
- ✅ Progress overlay shows all 4 steps
- ✅ Drafts overlay appears after generation
- ✅ 2-5 draft variants displayed (based on plan)
- ✅ Drafts are contextually appropriate
- ✅ Drafts are different from each other

---

### TC-DRAFT-002: New Email Draft Generation
**Objective**: Verify new email drafts are generated correctly

**Steps**:
1. Click Compose in Gmail
2. Enter recipient email
3. Optionally type some content
4. Click Generate button
5. Verify drafts are generated
6. Verify title shows "Smart Drafts, Instantly"

**Expected Results**:
- ✅ Progress overlay appears
- ✅ Drafts generated for new email
- ✅ Title shows "Smart Drafts, Instantly"
- ✅ Drafts are appropriate for new email context

---

### TC-DRAFT-003: Forward Draft Generation
**Objective**: Verify forward drafts are generated correctly

**Steps**:
1. Open email
2. Click Forward
3. Click Generate button
4. Verify drafts are generated
5. Verify forwarded content is used as context

**Expected Results**:
- ✅ Drafts generated for forward
- ✅ Forwarded message used as context
- ✅ User's typed content (if any) is considered
- ✅ Drafts are appropriate

---

### TC-DRAFT-004: Variant Count Respects Settings
**Objective**: Verify number of variants matches configuration

**Steps**:
1. Set numVariants to 2 in settings
2. Generate drafts for any email
3. Count number of variants displayed
4. Verify exactly 2 variants shown
5. Change numVariants to 5
6. Generate again
7. Verify exactly 5 variants shown

**Expected Results**:
- ✅ Number of variants matches numVariants setting
- ✅ Variants are limited correctly
- ✅ No extra variants shown
- ✅ Setting change takes effect immediately

---

### TC-DRAFT-005: Goal-Based Draft Generation
**Objective**: Verify multiple goals generate different draft sets

**Steps**:
1. Configure numGoals to 3
2. Generate drafts for email
3. Verify multiple goal tabs appear
4. Click each goal tab
5. Verify different draft sets for each goal

**Expected Results**:
- ✅ Multiple goal tabs displayed (if numGoals > 1)
- ✅ Each goal has its own draft set
- ✅ Drafts differ between goals
- ✅ Goal titles are descriptive

---

### TC-DRAFT-006: Tone-Based Draft Generation
**Objective**: Verify tone selector changes draft style

**Steps**:
1. Generate drafts for email
2. Verify tone selector dropdown appears (Pro+)
3. Select different tone
4. Verify drafts regenerate with new tone
5. Verify draft style changes

**Expected Results**:
- ✅ Tone selector appears (Pro+ plans)
- ✅ Tone selection triggers regeneration
- ✅ Drafts reflect selected tone
- ✅ Tone change is applied correctly

---

### TC-DRAFT-007: Streaming Draft Generation
**Objective**: Verify drafts stream in real-time

**Steps**:
1. Generate drafts for email
2. Observe progress overlay
3. Verify progress overlay removed when streaming starts
4. Verify drafts appear incrementally
5. Verify final drafts are complete

**Expected Results**:
- ✅ Streaming starts after progress overlay
- ✅ Drafts appear as they're generated
- ✅ No blocking or freezing
- ✅ Final drafts are complete and formatted

---

### TC-DRAFT-008: Draft Insertion
**Objective**: Verify drafts can be inserted into compose window

**Steps**:
1. Generate drafts
2. Click on a draft variant
3. Verify draft is inserted into compose window
4. Verify formatting is preserved
5. Verify cursor is at end of inserted text

**Expected Results**:
- ✅ Draft inserts with one click
- ✅ Formatting preserved
- ✅ Cursor positioned correctly
- ✅ Existing content not overwritten (if any)

---

### TC-DRAFT-009: Draft Regeneration
**Objective**: Verify drafts can be regenerated

**Steps**:
1. Generate drafts
2. Click regenerate button (if available)
3. Verify new drafts are generated
4. Verify new drafts are different from previous

**Expected Results**:
- ✅ Regeneration works
- ✅ New drafts generated
- ✅ Drafts differ from previous generation
- ✅ Settings are preserved

---

## Progress Overlay Tests

### TC-PROG-001: Progress Overlay Appearance
**Objective**: Verify progress overlay appears correctly

**Steps**:
1. Click Generate button
2. Verify progress overlay appears immediately
3. Verify overlay is centered
4. Verify overlay has correct styling
5. Verify 4 steps are visible

**Expected Results**:
- ✅ Overlay appears instantly
- ✅ Overlay is centered on screen
- ✅ Overlay styling is correct (white, rounded, shadow)
- ✅ All 4 steps visible
- ✅ Step 1 is active (spinner)

---

### TC-PROG-002: Step 1 - Semantic Context
**Objective**: Verify Step 1 updates correctly

**Steps**:
1. Click Generate button
2. Observe Step 1 "Determining Semantic Context..."
3. Wait for classification to complete
4. Verify Step 1 shows checkmark
5. Verify result shows "Semantic context: [Type]"
6. Verify Step 2 becomes active

**Expected Results**:
- ✅ Step 1 shows spinner initially
- ✅ Step 1 shows checkmark when complete
- ✅ Result displays correct semantic context
- ✅ Step 2 activates automatically

---

### TC-PROG-003: Step 2 - Analyzing Strategies
**Objective**: Verify Step 2 updates correctly

**Steps**:
1. Generate drafts and observe Step 2
2. Wait for goals determination
3. Verify Step 2 shows checkmark
4. Verify goal chips are displayed
5. Verify Step 3 becomes active

**Expected Results**:
- ✅ Step 2 activates after Step 1 completes
- ✅ Step 2 shows spinner while processing
- ✅ Step 2 shows checkmark when complete
- ✅ Goal chips displayed correctly
- ✅ Step 3 activates automatically

---

### TC-PROG-004: Step 3 - Selecting Tones
**Objective**: Verify Step 3 updates correctly

**Steps**:
1. Generate drafts and observe Step 3
2. Wait for tone determination
3. Verify Step 3 shows checkmark
4. Verify tone chips are displayed (blue color)
5. Verify Step 4 becomes active

**Expected Results**:
- ✅ Step 3 activates after Step 2 completes
- ✅ Step 3 shows spinner while processing
- ✅ Step 3 shows checkmark when complete
- ✅ Tone chips displayed in blue color
- ✅ Step 4 activates automatically

---

### TC-PROG-005: Step 4 - Generating Drafts
**Objective**: Verify Step 4 activates correctly

**Steps**:
1. Generate drafts and observe Step 4
2. Verify Step 4 becomes active after Step 3
3. Verify overlay is removed when streaming starts
4. Verify drafts overlay appears

**Expected Results**:
- ✅ Step 4 activates after Step 3 completes
- ✅ Step 4 shows spinner
- ✅ Overlay removed when streaming starts
- ✅ Smooth transition to drafts overlay

---

### TC-PROG-006: Progress Overlay Cancellation
**Objective**: Verify user can cancel progress overlay

**Steps**:
1. Click Generate button
2. Click Cancel button in progress overlay
3. Verify overlay closes
4. Verify generation stops (if possible)
5. Test Escape key cancellation

**Expected Results**:
- ✅ Cancel button closes overlay
- ✅ Escape key closes overlay
- ✅ Generation stops or handles cancellation gracefully
- ✅ Button state resets

---

### TC-PROG-007: Progress Overlay Error Handling
**Objective**: Verify progress overlay handles errors

**Steps**:
1. Disconnect internet
2. Click Generate button
3. Verify progress overlay appears
4. Wait for error
5. Verify overlay is removed
6. Verify error message is shown

**Expected Results**:
- ✅ Overlay appears initially
- ✅ Overlay removed on error
- ✅ Error message displayed to user
- ✅ Button state resets

---

## Drafts Overlay Tests

### TC-OVERLAY-001: Drafts Overlay Appearance
**Objective**: Verify drafts overlay displays correctly

**Steps**:
1. Generate drafts
2. Verify drafts overlay appears
3. Verify title shows "Smart Replies, Instantly" (reply) or "Smart Drafts, Instantly" (new email)
4. Verify package information is shown
5. Verify intent and topics are displayed

**Expected Results**:
- ✅ Overlay appears after generation
- ✅ Title is correct based on action type
- ✅ Package information displayed
- ✅ Intent and topics shown
- ✅ Overlay is scrollable if content is long

---

### TC-OVERLAY-002: Draft Variants Display
**Objective**: Verify draft variants are displayed correctly

**Steps**:
1. Generate drafts with numVariants = 3
2. Verify 3 variants are displayed
3. Verify each variant has label (Variant 1, Variant 2, etc.)
4. Verify variants are separated visually
5. Verify variants are different from each other

**Expected Results**:
- ✅ Correct number of variants displayed
- ✅ Variants are labeled clearly
- ✅ Variants are visually separated
- ✅ Variants have distinct content

---

### TC-OVERLAY-003: Goal Tabs (Multiple Goals)
**Objective**: Verify goal tabs work correctly

**Steps**:
1. Configure numGoals to 3
2. Generate drafts
3. Verify 3 goal tabs appear
4. Click each tab
5. Verify different draft sets for each goal

**Expected Results**:
- ✅ Goal tabs appear when numGoals > 1
- ✅ Tabs are clickable
- ✅ Active tab is highlighted
- ✅ Each tab shows different drafts
- ✅ Tab switching is smooth

---

### TC-OVERLAY-004: Tone Selector (Pro+)
**Objective**: Verify tone selector works

**Steps**:
1. Generate drafts (Pro+ plan)
2. Verify tone selector dropdown appears
3. Select different tone
4. Verify drafts regenerate
5. Verify new tone is applied

**Expected Results**:
- ✅ Tone selector appears (Pro+ only)
- ✅ Dropdown shows available tones
- ✅ Tone selection triggers regeneration
- ✅ New drafts reflect selected tone

---

### TC-OVERLAY-005: Draft Selection and Insertion
**Objective**: Verify draft selection and insertion

**Steps**:
1. Generate drafts
2. Click on a draft variant
3. Verify draft is highlighted/selected
4. Verify draft inserts into compose window
5. Verify formatting is preserved

**Expected Results**:
- ✅ Draft selection works
- ✅ Selected draft is visually indicated
- ✅ Draft inserts correctly
- ✅ Formatting preserved
- ✅ Cursor positioned at end

---

### TC-OVERLAY-006: Overlay Close
**Objective**: Verify overlay can be closed

**Steps**:
1. Generate drafts
2. Click X button to close
3. Verify overlay closes
4. Test Escape key
5. Test click outside overlay (if implemented)

**Expected Results**:
- ✅ X button closes overlay
- ✅ Escape key closes overlay
- ✅ Overlay closes smoothly
- ✅ Compose window remains open

---

## Subscription Plan Tests

### TC-PLAN-001: Free Plan Limits
**Objective**: Verify Free plan limits are enforced

**Steps**:
1. Set subscription to Free plan
2. Verify numVariants max is 2
3. Verify numGoals max is 1
4. Verify numTones max is 2
5. Attempt to generate 31st draft (should fail or warn)

**Expected Results**:
- ✅ Variants limited to 2
- ✅ Goals limited to 1
- ✅ Tones limited to 2
- ✅ Monthly limit enforced (30 drafts)
- ✅ Appropriate error/warning shown at limit

---

### TC-PLAN-002: Basic Plan Limits
**Objective**: Verify Basic plan limits are enforced

**Steps**:
1. Set subscription to Basic plan
2. Verify numVariants max is 3
3. Verify numGoals max is 3
4. Verify numTones max is 3
5. Verify monthly limit is 200

**Expected Results**:
- ✅ Variants limited to 3
- ✅ Goals limited to 3
- ✅ Tones limited to 3
- ✅ Monthly limit enforced
- ✅ Generic package only

---

### TC-PLAN-003: Pro Plan Features
**Objective**: Verify Pro plan features work

**Steps**:
1. Set subscription to Pro plan
2. Verify numVariants max is 5
3. Verify numGoals max is 5
4. Verify numTones max is 5
5. Verify unlimited drafts
6. Verify package selection available
7. Verify style mimicking available

**Expected Results**:
- ✅ All limits are 5
- ✅ Unlimited drafts work
- ✅ Package selection enabled
- ✅ Style mimicking enabled
- ✅ All models available

---

### TC-PLAN-004: Ultimate Plan Features
**Objective**: Verify Ultimate plan features work

**Steps**:
1. Set subscription to Ultimate plan
2. Verify all Pro features work
3. Verify all packages are available
4. Verify no package restrictions

**Expected Results**:
- ✅ All Pro features work
- ✅ All packages available
- ✅ No package purchase needed
- ✅ All features unlocked

---

### TC-PLAN-005: Plan Upgrade/Downgrade
**Objective**: Verify plan changes take effect

**Steps**:
1. Start with Free plan
2. Generate drafts (verify limits)
3. Upgrade to Pro plan
4. Verify new limits apply
5. Generate drafts with new limits

**Expected Results**:
- ✅ Plan change is recognized
- ✅ New limits apply immediately
- ✅ Settings update correctly
- ✅ Features unlock/lock appropriately

---

## Style Mimicking Tests

### TC-STYLE-001: Style Analysis
**Objective**: Verify style analysis runs in background

**Steps**:
1. Enable style mimicking (Pro+)
2. Send/reply to several emails
3. Verify style analysis runs
4. Verify style profile is created
5. Check Chrome storage for style data

**Expected Results**:
- ✅ Style analysis runs in background
- ✅ No blocking of draft generation
- ✅ Style profile created
- ✅ Profile stored locally

---

### TC-STYLE-002: Style Application
**Objective**: Verify learned style is applied to drafts

**Steps**:
1. Enable style mimicking
2. Generate drafts after style profile exists
3. Compare drafts to user's writing style
4. Verify drafts match user's style characteristics

**Expected Results**:
- ✅ Drafts reflect learned style
- ✅ Sentence length matches user's style
- ✅ Formality level matches
- ✅ Vocabulary style matches

---

### TC-STYLE-003: Style Profile Updates
**Objective**: Verify style profile updates over time

**Steps**:
1. Enable style mimicking
2. Generate and send several emails
3. Verify style profile updates
4. Generate new drafts
5. Verify style continues to improve

**Expected Results**:
- ✅ Style profile updates
- ✅ Profile improves over time
- ✅ Drafts become more personalized
- ✅ Updates don't break existing functionality

---

## Error Handling Tests

### TC-ERROR-001: API Key Missing
**Objective**: Verify error handling for missing API key

**Steps**:
1. Remove API key from settings
2. Click Generate button
3. Verify error message is shown
4. Verify error is user-friendly

**Expected Results**:
- ✅ Error message appears
- ✅ Message is clear and actionable
- ✅ User knows what to do
- ✅ Extension doesn't crash

---

### TC-ERROR-002: Invalid API Key
**Objective**: Verify error handling for invalid API key

**Steps**:
1. Enter invalid API key
2. Click Generate button
3. Verify error message is shown
4. Verify error indicates authentication issue

**Expected Results**:
- ✅ Error message appears
- ✅ Error indicates authentication failure
- ✅ User can correct API key
- ✅ Extension recovers gracefully

---

### TC-ERROR-003: Network Error
**Objective**: Verify error handling for network issues

**Steps**:
1. Disconnect internet
2. Click Generate button
3. Verify error message is shown
4. Reconnect internet
5. Verify extension works again

**Expected Results**:
- ✅ Network error detected
- ✅ Error message shown
- ✅ Extension recovers when connection restored
- ✅ No data loss

---

### TC-ERROR-004: API Rate Limit
**Objective**: Verify error handling for rate limits

**Steps**:
1. Generate many drafts quickly
2. Trigger rate limit (if possible)
3. Verify error message is shown
4. Verify user can retry after delay

**Expected Results**:
- ✅ Rate limit error detected
- ✅ Error message is clear
- ✅ Retry option available
- ✅ Extension handles gracefully

---

### TC-ERROR-005: API Server Error
**Objective**: Verify error handling for server errors

**Steps**:
1. Simulate 500 server error (if possible)
2. Click Generate button
3. Verify error message is shown
4. Verify fallback behavior

**Expected Results**:
- ✅ Server error detected
- ✅ Error message shown
- ✅ Fallback to default values (if applicable)
- ✅ Extension doesn't crash

---

## Edge Cases & Boundary Tests

### TC-EDGE-001: Empty Email Thread
**Objective**: Verify handling of empty or minimal email content

**Steps**:
1. Create new email with no content
2. Click Generate
3. Verify drafts are still generated
4. Verify drafts are appropriate

**Expected Results**:
- ✅ Extension handles empty content
- ✅ Drafts generated with minimal context
- ✅ No errors or crashes
- ✅ Drafts are still useful

---

### TC-EDGE-002: Very Long Email
**Objective**: Verify handling of very long emails

**Steps**:
1. Open email with 5000+ words
2. Click Reply and Generate
3. Verify extension processes correctly
4. Verify drafts are generated

**Expected Results**:
- ✅ Long emails processed
- ✅ No timeout errors
- ✅ Drafts generated correctly
- ✅ Performance is acceptable

---

### TC-EDGE-003: Special Characters
**Objective**: Verify handling of special characters

**Steps**:
1. Create email with special characters (emojis, unicode, etc.)
2. Click Generate
3. Verify special characters are preserved
4. Verify drafts handle special characters

**Expected Results**:
- ✅ Special characters preserved
- ✅ No encoding issues
- ✅ Drafts include special characters correctly
- ✅ No crashes or errors

---

### TC-EDGE-004: Multiple Languages
**Objective**: Verify handling of non-English emails

**Steps**:
1. Open email in different language (Spanish, French, etc.)
2. Click Reply and Generate
3. Verify extension processes correctly
4. Verify drafts are in appropriate language

**Expected Results**:
- ✅ Non-English emails processed
- ✅ Language detected correctly
- ✅ Drafts in appropriate language
- ✅ No encoding issues

---

### TC-EDGE-005: Rapid Button Clicks
**Objective**: Verify handling of rapid button clicks

**Steps**:
1. Click Generate button rapidly multiple times
2. Verify only one generation starts
3. Verify no duplicate overlays
4. Verify extension handles gracefully

**Expected Results**:
- ✅ Only one generation starts
- ✅ Button disabled during generation
- ✅ No duplicate overlays
- ✅ No errors or crashes

---

### TC-EDGE-006: Compose Window Closed During Generation
**Objective**: Verify handling when compose window closes

**Steps**:
1. Start draft generation
2. Close compose window while generating
3. Verify extension handles gracefully
4. Verify no errors or crashes

**Expected Results**:
- ✅ Extension detects window closure
- ✅ Generation stops or completes gracefully
- ✅ No errors or crashes
- ✅ Clean state maintained

---

## Performance Tests

### TC-PERF-001: Generation Speed
**Objective**: Verify draft generation completes in reasonable time

**Steps**:
1. Click Generate button
2. Measure time from click to first draft
3. Measure time to complete generation
4. Verify times are acceptable (< 30 seconds)

**Expected Results**:
- ✅ First draft appears within 10-15 seconds
- ✅ Complete generation within 30 seconds
- ✅ Progress overlay provides feedback
- ✅ No perceived freezing

---

### TC-PERF-002: Memory Usage
**Objective**: Verify extension doesn't cause memory issues

**Steps**:
1. Open Chrome Task Manager
2. Generate multiple drafts
3. Monitor memory usage
4. Verify memory doesn't grow excessively

**Expected Results**:
- ✅ Memory usage is reasonable
- ✅ No memory leaks
- ✅ Memory released after generation
- ✅ Extension doesn't slow browser

---

### TC-PERF-003: Multiple Generations
**Objective**: Verify extension handles multiple generations

**Steps**:
1. Generate drafts for 10 different emails
2. Verify each generation works
3. Verify no performance degradation
4. Verify no memory leaks

**Expected Results**:
- ✅ All generations work
- ✅ Performance consistent
- ✅ No degradation over time
- ✅ Memory usage stable

---

## Accessibility Tests

### TC-ACC-001: Keyboard Navigation
**Objective**: Verify keyboard navigation works

**Steps**:
1. Use Tab to navigate to Generate button
2. Press Enter to activate
3. Use Tab in overlays
4. Use Escape to close
5. Verify all functions accessible via keyboard

**Expected Results**:
- ✅ Button accessible via keyboard
- ✅ Overlays navigable via keyboard
- ✅ Escape key works
- ✅ Focus indicators visible

---

### TC-ACC-002: Screen Reader Compatibility
**Objective**: Verify screen reader compatibility

**Steps**:
1. Enable screen reader
2. Navigate to Generate button
3. Verify button is announced
4. Verify overlay content is announced
5. Verify draft content is accessible

**Expected Results**:
- ✅ Button has accessible label
- ✅ Overlay content is readable
- ✅ Drafts are accessible
- ✅ ARIA labels present (if applicable)

---

### TC-ACC-003: Color Contrast
**Objective**: Verify color contrast meets accessibility standards

**Steps**:
1. Check button text contrast
2. Check overlay text contrast
3. Check draft text contrast
4. Verify WCAG AA compliance

**Expected Results**:
- ✅ Text contrast meets WCAG AA
- ✅ Interactive elements have sufficient contrast
- ✅ Color not sole indicator of state
- ✅ Accessible to colorblind users

---

## Cross-Browser Tests

### TC-BROWSER-001: Chrome Compatibility
**Objective**: Verify extension works in Chrome

**Steps**:
1. Install extension in Chrome
2. Test all major features
3. Verify no Chrome-specific issues

**Expected Results**:
- ✅ All features work in Chrome
- ✅ No Chrome-specific bugs
- ✅ Performance is good

---

### TC-BROWSER-002: Edge Compatibility
**Objective**: Verify extension works in Edge

**Steps**:
1. Install extension in Edge (Chromium)
2. Test all major features
3. Verify compatibility

**Expected Results**:
- ✅ Extension installs in Edge
- ✅ All features work
- ✅ No Edge-specific issues

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Extension installed
- [ ] API keys configured
- [ ] Test accounts ready (Gmail, LinkedIn)
- [ ] Test emails prepared
- [ ] Browser cleared of cache/cookies

### Test Execution
- [ ] Installation tests passed
- [ ] Gmail integration tests passed
- [ ] LinkedIn integration tests passed
- [ ] Classification tests passed
- [ ] Draft generation tests passed
- [ ] Progress overlay tests passed
- [ ] Drafts overlay tests passed
- [ ] Subscription plan tests passed
- [ ] Style mimicking tests passed
- [ ] Error handling tests passed
- [ ] Edge cases tests passed
- [ ] Performance tests passed
- [ ] Accessibility tests passed

### Post-Test
- [ ] All critical tests passed
- [ ] Known issues documented
- [ ] Test results recorded
- [ ] Sign-off obtained

---

## Test Sign-Off

**Tester Name**: _________________  
**Date**: _________________  
**Version Tested**: 5.0.4  
**Overall Result**: ☐ Pass  ☐ Fail  ☐ Pass with Issues  

**Comments**:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

**Approval**:
**Product Owner**: _________________  **Date**: _________________  
**QA Lead**: _________________  **Date**: _________________

---

**Document End**
