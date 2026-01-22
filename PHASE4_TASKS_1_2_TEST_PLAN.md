# Phase 4 Tasks 1 & 2 - Test Plan

**Date**: 2026-01-22  
**Tasks**: 
- Task 1: Display active packages from API (`/api/packages/list`)
- Task 2: Stripe checkout integration for package purchases

---

## Test Environment Setup

### Prerequisites
- ✅ Valid license key (Pro plan for package purchases)
- ✅ Extension installed and loaded
- ✅ Options page accessible
- ✅ Backend API deployed and accessible
- ✅ Stripe test mode configured

### Getting Test License Keys

**See**: `HOW_TO_GET_TEST_LICENSE_KEYS.md` for complete instructions

**Quick Setup** (Recommended):
```powershell
# Set Supabase environment variables
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"

# Create test licenses
cd c:\VScode\responsable-api
node tests\setup-test-data.js licenses
```

This will create test licenses for all plans and display the license keys.

### Test Data
- **License Key**: Use Pro license key from test setup script
- **Test Package**: Any purchasable package for Pro plan (from `/api/packages/list`)
- **Stripe Test Mode**: Enabled
- **Test Card**: `4242 4242 4242 4242` (Stripe test mode)

---

## Test Cases

### Task 1: Display Active Packages from API

#### TC-1.1: Load Packages on License Activation
**Objective**: Verify packages are fetched when license is activated

**Steps**:
1. Open extension Options page
2. Enter valid license key
3. Click "Activate License"
4. Wait for license validation

**Expected Results**:
- ✅ License validates successfully
- ✅ Packages are automatically fetched
- ✅ "Your Packages" section appears
- ✅ Packages are displayed in correct categories (included, purchased, available)

**Status**: ⏳ Pending

---

#### TC-1.2: Display Included Packages
**Objective**: Verify included packages from plan are shown

**Steps**:
1. Activate Pro or Ultimate plan license
2. Check "Your Packages" section

**Expected Results**:
- ✅ "Included Packages" section appears
- ✅ Shows packages included with the plan
- ✅ Each package shows name, description, and "✓ Active" status
- ✅ Packages match plan's included package

**Status**: ⏳ Pending

---

#### TC-1.3: Display Purchased Packages
**Objective**: Verify purchased packages are shown

**Steps**:
1. Activate license that has purchased packages
2. Check "Your Packages" section

**Expected Results**:
- ✅ "Purchased Packages" section appears (if any exist)
- ✅ Shows package name, description, status
- ✅ Shows payment status if available
- ✅ Status indicator shows active/inactive

**Status**: ⏳ Pending

---

#### TC-1.4: Display Available Packages for Purchase
**Objective**: Verify purchasable packages are shown

**Steps**:
1. Activate Pro plan license
2. Check "Your Packages" section

**Expected Results**:
- ✅ "Available Packages" section appears
- ✅ Shows packages available for purchase
- ✅ Each package shows name, description, and price
- ✅ "Purchase $X.XX" button is visible and clickable

**Status**: ⏳ Pending

---

#### TC-1.5: Handle No License Key
**Objective**: Verify behavior when no license is active

**Steps**:
1. Open Options page without license key
2. Check "Your Packages" section

**Expected Results**:
- ✅ "Your Packages" section does not appear
- ✅ No error messages shown
- ✅ Page loads normally

**Status**: ⏳ Pending

---

#### TC-1.6: Handle Invalid License Key
**Objective**: Verify error handling for invalid license

**Steps**:
1. Enter invalid license key
2. Click "Activate License"
3. Check packages section

**Expected Results**:
- ✅ License validation fails
- ✅ Error message displayed
- ✅ Packages are not fetched
- ✅ "Your Packages" section does not appear

**Status**: ⏳ Pending

---

#### TC-1.7: Handle API Error
**Objective**: Verify error handling when API fails

**Steps**:
1. Activate valid license
2. Simulate API failure (network error or invalid response)
3. Check error handling

**Expected Results**:
- ✅ Error is caught and logged
- ✅ User-friendly error message displayed
- ✅ Page does not crash
- ✅ Loading state is cleared

**Status**: ⏳ Pending

---

### Task 2: Stripe Checkout Integration

#### TC-2.1: Purchase Button Click - Valid License
**Objective**: Verify purchase flow starts correctly

**Steps**:
1. Activate Pro plan license
2. Ensure packages are loaded
3. Click "Purchase $X.XX" button on available package
4. Confirm purchase dialog

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ Dialog shows package name
- ✅ On confirm, API call is made
- ✅ Loading state shown (if applicable)

**Status**: ⏳ Pending

---

#### TC-2.2: Purchase Button Click - No License
**Objective**: Verify purchase blocked without license

**Steps**:
1. Open Options page without license
2. Try to click purchase button (if visible)

**Expected Results**:
- ✅ Alert shown: "Please activate your license key first."
- ✅ No API call made
- ✅ No redirect to Stripe

**Status**: ⏳ Pending

---

#### TC-2.3: Purchase Button Click - Invalid License
**Objective**: Verify purchase blocked with invalid license

**Steps**:
1. Enter invalid license key
2. Try to click purchase button

**Expected Results**:
- ✅ Alert shown: "Please ensure your license key is valid..."
- ✅ No API call made
- ✅ No redirect to Stripe

**Status**: ⏳ Pending

---

#### TC-2.4: Stripe Checkout Session Creation
**Objective**: Verify Stripe checkout session is created

**Steps**:
1. Activate Pro plan license
2. Click purchase button on available package
3. Confirm purchase
4. Monitor network requests

**Expected Results**:
- ✅ POST request to `/api/packages/purchase`
- ✅ Request includes: licenseKey, packageId, successUrl, cancelUrl
- ✅ Response includes: `checkout_url` and `session_id`
- ✅ Response status: 200

**Status**: ⏳ Pending

---

#### TC-2.5: Redirect to Stripe Checkout
**Objective**: Verify redirect to Stripe checkout page

**Steps**:
1. Complete TC-2.4
2. Check if redirect occurs

**Expected Results**:
- ✅ Page redirects to Stripe checkout URL
- ✅ Stripe checkout page loads
- ✅ Shows correct package name and price
- ✅ Payment form is visible

**Status**: ⏳ Pending

---

#### TC-2.6: Stripe Checkout - Success Flow
**Objective**: Verify success redirect handling

**Steps**:
1. Complete purchase in Stripe (use test card)
2. Complete payment
3. Return to options page

**Expected Results**:
- ✅ Redirected to options page with `?purchase=success&package=...`
- ✅ Success message displayed
- ✅ Packages list automatically refreshes
- ✅ URL cleaned (no query params remain)
- ✅ Purchased package appears in "Purchased Packages" section

**Status**: ⏳ Pending

---

#### TC-2.7: Stripe Checkout - Cancel Flow
**Objective**: Verify cancel redirect handling

**Steps**:
1. Start purchase flow
2. Click cancel in Stripe checkout
3. Return to options page

**Expected Results**:
- ✅ Redirected to options page with `?purchase=cancel`
- ✅ No error message (silent cancel)
- ✅ URL cleaned (no query params remain)
- ✅ Packages list unchanged

**Status**: ⏳ Pending

---

#### TC-2.8: API Error Handling
**Objective**: Verify error handling for API failures

**Steps**:
1. Activate valid license
2. Click purchase button
3. Simulate API error (network failure, invalid response)

**Expected Results**:
- ✅ Error caught and logged
- ✅ User-friendly error message: "Failed to initiate purchase..."
- ✅ No redirect occurs
- ✅ Page remains functional

**Status**: ⏳ Pending

---

#### TC-2.9: Already Purchased Package
**Objective**: Verify handling of already purchased package

**Steps**:
1. Activate license with already purchased package
2. Try to purchase same package again

**Expected Results**:
- ✅ API returns error: "You already have an active subscription..."
- ✅ Error message displayed to user
- ✅ No checkout session created

**Status**: ⏳ Pending

---

#### TC-2.10: Non-Pro Plan Purchase Attempt
**Objective**: Verify purchase blocked for non-Pro plans

**Steps**:
1. Activate Basic or Free plan license
2. Try to purchase package

**Expected Results**:
- ✅ API returns error: "Package purchases are only available for Pro plan"
- ✅ Error message displayed
- ✅ No checkout session created

**Status**: ⏳ Pending

---

## Test Execution Checklist

### Manual Testing Steps

1. **Setup**:
   - [ ] Open Chrome extension Options page
   - [ ] Verify page loads correctly
   - [ ] Check console for errors

2. **Task 1 Tests**:
   - [ ] TC-1.1: Load packages on license activation
   - [ ] TC-1.2: Display included packages
   - [ ] TC-1.3: Display purchased packages
   - [ ] TC-1.4: Display available packages
   - [ ] TC-1.5: Handle no license key
   - [ ] TC-1.6: Handle invalid license key
   - [ ] TC-1.7: Handle API error

3. **Task 2 Tests**:
   - [ ] TC-2.1: Purchase button click - valid license
   - [ ] TC-2.2: Purchase button click - no license
   - [ ] TC-2.3: Purchase button click - invalid license
   - [ ] TC-2.4: Stripe checkout session creation
   - [ ] TC-2.5: Redirect to Stripe checkout
   - [ ] TC-2.6: Success flow
   - [ ] TC-2.7: Cancel flow
   - [ ] TC-2.8: API error handling
   - [ ] TC-2.9: Already purchased package
   - [ ] TC-2.10: Non-Pro plan purchase attempt

---

## Test Results Summary

**Date**: 2026-01-22  
**Tester**: Automated + Manual  
**Environment**: Development

### Automated API Tests (Initial Run)

**Tests Executed**: 2  
**Passed**: 2  
**Failed**: 0  
**Pass Rate**: 100%

**Tests Run**:
- ✅ TC-1.6: Package List API - Invalid License (PASSED)
- ✅ TC-2.3: Package Purchase API - Invalid License (PASSED)

**Tests Pending** (Require License Key):
- ⏳ TC-1.1: Package List API - Valid License
- ⏳ TC-2.4: Package Purchase API - Create Checkout Session

### Manual UI Tests

**Status**: ⏳ Pending Execution

**See**: `PHASE4_MANUAL_TESTING_GUIDE.md` for detailed steps

### Task 1 Results
- Total Tests: 7
- Automated: 1/2 passed (1 pending)
- Manual: 0/5 executed
- Pass Rate: TBD%

### Task 2 Results
- Total Tests: 10
- Automated: 1/2 passed (1 pending)
- Manual: 0/8 executed
- Pass Rate: TBD%

### Overall Results
- Total Tests: 17
- Passed: 2 (automated)
- Failed: 0
- Pending: 15 (require license key or manual testing)
- Pass Rate: 100% (of executed tests)

---

## Issues Found

### Critical Issues
- None yet

### High Priority Issues
- None yet

### Medium Priority Issues
- None yet

### Low Priority Issues
- None yet

---

## Notes

- Stripe test mode should be used for all purchase tests
- Use Stripe test card: `4242 4242 4242 4242`
- Test expiration: Any future date
- Test CVC: Any 3 digits

---

**Last Updated**: 2026-01-22
