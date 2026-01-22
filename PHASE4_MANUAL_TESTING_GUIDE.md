# Phase 4 Tasks 1 & 2 - Manual Testing Guide

**Date**: 2026-01-22  
**Purpose**: Step-by-step guide for manual testing of Options page features

---

## Prerequisites

1. **Extension Installed**:
   - Load extension in Chrome (Developer mode)
   - Extension should be unpacked and active

2. **Test License Keys**:
   - Pro plan license key (for package purchase testing)
   - Basic/Free plan license key (for negative testing)
   - Invalid license key (for error testing)

3. **Stripe Test Mode**:
   - Ensure backend is using Stripe test mode
   - Test card: `4242 4242 4242 4242`
   - Expiration: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)

---

## Testing Task 1: Display Active Packages

### Test 1.1: Open Options Page

**Steps**:
1. Right-click extension icon → "Options"
2. Or navigate to `chrome://extensions` → Find extension → Click "Options"

**Expected**:
- ✅ Options page loads
- ✅ No console errors
- ✅ All tabs visible (Models, Packages, Default Role, etc.)

---

### Test 1.2: Activate Valid License Key

**Steps**:
1. Scroll to "License Activation" section (top of page)
2. Enter valid Pro plan license key
3. Click "Activate License" button
4. Wait for validation

**Expected**:
- ✅ Button shows "Validating..." during request
- ✅ Success message: "Active Pro – expires [date]"
- ✅ License status shows green checkmark
- ✅ Subscription plan dropdown updates to "Pro"

**Check Console**:
- ✅ No errors
- ✅ Network request to `/api/validate` succeeds (200)
- ✅ Network request to `/api/packages/list` succeeds (200)

---

### Test 1.3: Verify Packages Section Appears

**Steps**:
1. After license activation, scroll down
2. Look for "Your Packages" section

**Expected**:
- ✅ "Your Packages" section appears below "Email Type Packages"
- ✅ Section shows loading state briefly
- ✅ Packages load and display

---

### Test 1.4: Verify Included Packages Display

**Steps**:
1. Check "Included Packages" subsection
2. Review displayed packages

**Expected**:
- ✅ "Included Packages" heading appears
- ✅ Shows packages included with the plan
- ✅ Each package shows:
  - Package name (capitalized)
  - Description
  - "✓ Active" status indicator (green)
- ✅ Packages match plan's included package

**Example**:
```
Included Packages
┌─────────────────────────────────────┐
│ ✓ Sales                             │
│   Sales outreach and follow-up...   │
│   ✓ Active                          │
└─────────────────────────────────────┘
```

---

### Test 1.5: Verify Purchased Packages Display

**Steps**:
1. Check "Purchased Packages" subsection (if any exist)
2. Review displayed packages

**Expected**:
- ✅ "Purchased Packages" heading appears (if packages exist)
- ✅ Shows packages purchased separately
- ✅ Each package shows:
  - Package name
  - Description
  - Status indicator (Active/Inactive/Past Due)
  - Payment status (if available)

**Note**: This section may be empty if no packages have been purchased.

---

### Test 1.6: Verify Available Packages Display

**Steps**:
1. Check "Available Packages" subsection
2. Review displayed packages
3. Check purchase buttons

**Expected**:
- ✅ "Available Packages" heading appears
- ✅ Shows packages available for purchase
- ✅ Each package shows:
  - Package name
  - Description
  - Price (e.g., "Purchase $15.00")
- ✅ Purchase button is visible and styled correctly
- ✅ Button has hover effect (darker blue on hover)

**Example**:
```
Available Packages
Purchase additional packages to unlock more email types.

┌─────────────────────────────────────────────┐
│ Recruitment                                 │
│ Recruiting and talent acquisition emails    │
│                          [Purchase $15.00]  │
└─────────────────────────────────────────────┘
```

---

### Test 1.7: Test Invalid License Key

**Steps**:
1. Clear license key field
2. Enter invalid license key (e.g., "invalid-key-123")
3. Click "Activate License"
4. Check packages section

**Expected**:
- ✅ Error message: "Invalid license key"
- ✅ License status shows red X
- ✅ "Your Packages" section does NOT appear
- ✅ Subscription plan reverts to "Free"

---

### Test 1.8: Test No License Key

**Steps**:
1. Clear license key field
2. Leave field empty
3. Click "Activate License"
4. Check packages section

**Expected**:
- ✅ Error message: "Please enter a license key"
- ✅ "Your Packages" section does NOT appear
- ✅ Subscription plan is "Free"

---

## Testing Task 2: Stripe Checkout Integration

### Test 2.1: Purchase Button Click - Valid License

**Steps**:
1. Ensure valid Pro plan license is activated
2. Ensure packages are loaded
3. Find an available package in "Available Packages" section
4. Click "Purchase $X.XX" button
5. Check confirmation dialog

**Expected**:
- ✅ Confirmation dialog appears
- ✅ Dialog message: "Purchase [package-name] package? You will be redirected to Stripe checkout."
- ✅ Dialog has "OK" and "Cancel" buttons

---

### Test 2.2: Purchase Flow - Confirm Purchase

**Steps**:
1. Complete Test 2.1
2. Click "OK" in confirmation dialog
3. Monitor network requests (F12 → Network tab)
4. Check for redirect

**Expected**:
- ✅ Confirmation dialog closes
- ✅ Network request to `/api/packages/purchase`:
  - Method: POST
  - Status: 200
  - Request body includes: `licenseKey`, `packageId`, `successUrl`, `cancelUrl`
  - Response includes: `checkout_url`, `session_id`
- ✅ Page redirects to Stripe checkout URL
- ✅ Stripe checkout page loads

**Check Console**:
- ✅ No errors
- ✅ Request/response logged correctly

---

### Test 2.3: Stripe Checkout Page

**Steps**:
1. Complete Test 2.2 (redirected to Stripe)
2. Review Stripe checkout page

**Expected**:
- ✅ Stripe checkout page loads
- ✅ Shows correct package name
- ✅ Shows correct price
- ✅ Payment form is visible
- ✅ "Pay" button is visible

---

### Test 2.4: Complete Purchase (Test Mode)

**Steps**:
1. Complete Test 2.3
2. Enter test card: `4242 4242 4242 4242`
3. Enter expiration: `12/34`
4. Enter CVC: `123`
5. Enter any name
6. Click "Pay" button
7. Complete payment

**Expected**:
- ✅ Payment processes successfully
- ✅ Redirects to success URL: `chrome-extension://.../options.html?purchase=success&package=[name]`
- ✅ Options page loads
- ✅ Success message appears: "Successfully purchased [package] package! Refreshing packages..."
- ✅ Packages list automatically refreshes
- ✅ URL is cleaned (no query params)
- ✅ Purchased package appears in "Purchased Packages" section

---

### Test 2.5: Cancel Purchase Flow

**Steps**:
1. Complete Test 2.2 (redirected to Stripe)
2. Click "Cancel" or close Stripe checkout
3. Return to options page

**Expected**:
- ✅ Redirects to cancel URL: `chrome-extension://.../options.html?purchase=cancel`
- ✅ Options page loads
- ✅ No error message (silent cancel)
- ✅ URL is cleaned (no query params)
- ✅ Packages list unchanged

---

### Test 2.6: Purchase Button - No License

**Steps**:
1. Clear license key (or use page without license)
2. Try to click purchase button (if visible)

**Expected**:
- ✅ Alert appears: "Please activate your license key first."
- ✅ No API call made
- ✅ No redirect occurs

---

### Test 2.7: Purchase Button - Invalid License

**Steps**:
1. Enter invalid license key
2. Try to click purchase button

**Expected**:
- ✅ Alert appears: "Please ensure your license key is valid before purchasing packages."
- ✅ No API call made
- ✅ No redirect occurs

---

### Test 2.8: Purchase Button - Cancel Confirmation

**Steps**:
1. Complete Test 2.1 (confirmation dialog appears)
2. Click "Cancel" in dialog

**Expected**:
- ✅ Dialog closes
- ✅ No API call made
- ✅ No redirect occurs
- ✅ Page remains unchanged

---

### Test 2.9: Already Purchased Package

**Steps**:
1. Activate license with already purchased package
2. Try to purchase same package again
3. Click purchase button and confirm

**Expected**:
- ✅ API call is made
- ✅ API returns error: "You already have an active subscription for this package"
- ✅ Alert shown with error message
- ✅ No checkout session created
- ✅ No redirect occurs

---

### Test 2.10: Non-Pro Plan Purchase Attempt

**Steps**:
1. Activate Basic or Free plan license
2. Try to purchase package
3. Click purchase button and confirm

**Expected**:
- ✅ API call is made
- ✅ API returns error: "Package purchases are only available for Pro plan"
- ✅ Alert shown with error message
- ✅ No checkout session created
- ✅ No redirect occurs

---

## Browser Console Checks

### Network Tab Monitoring

**What to Check**:
1. **License Validation**:
   - Request: `POST /api/validate`
   - Status: 200
   - Response: `{ valid: true, plan: "pro", ... }`

2. **Package List**:
   - Request: `POST /api/packages/list`
   - Status: 200
   - Response: `{ valid: true, packages: { included: [...], purchased: [...], available: [...] } }`

3. **Package Purchase**:
   - Request: `POST /api/packages/purchase`
   - Status: 200
   - Response: `{ success: true, checkout_url: "...", session_id: "..." }`

### Console Errors

**What to Check**:
- ✅ No JavaScript errors
- ✅ No CORS errors
- ✅ No network errors
- ✅ No undefined variable errors

---

## Test Checklist

### Task 1: Display Packages
- [ ] TC-1.1: Options page loads
- [ ] TC-1.2: Activate valid license
- [ ] TC-1.3: Packages section appears
- [ ] TC-1.4: Included packages display
- [ ] TC-1.5: Purchased packages display
- [ ] TC-1.6: Available packages display
- [ ] TC-1.7: Invalid license handling
- [ ] TC-1.8: No license handling

### Task 2: Stripe Checkout
- [ ] TC-2.1: Purchase button click
- [ ] TC-2.2: Confirm purchase dialog
- [ ] TC-2.3: API call made correctly
- [ ] TC-2.4: Redirect to Stripe
- [ ] TC-2.5: Stripe checkout page
- [ ] TC-2.6: Complete purchase (test mode)
- [ ] TC-2.7: Success redirect handling
- [ ] TC-2.8: Cancel redirect handling
- [ ] TC-2.9: No license error
- [ ] TC-2.10: Invalid license error
- [ ] TC-2.11: Cancel confirmation
- [ ] TC-2.12: Already purchased error
- [ ] TC-2.13: Non-Pro plan error

---

## Issues to Report

When reporting issues, include:
1. **Test Case**: Which test failed
2. **Steps**: Exact steps to reproduce
3. **Expected**: What should happen
4. **Actual**: What actually happened
5. **Console Errors**: Any errors in browser console
6. **Network Requests**: Screenshot of failed request/response
7. **Environment**: Browser version, extension version

---

**Last Updated**: 2026-01-22
