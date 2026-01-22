# Analysis of `handleSubscriptionPlanChange` Usage

**Date**: 2026-01-22

---

## Current Usage Analysis

### 1. **Line 165** - Initial Load (No License Key)
```typescript
// No license key - ensure plan is set to free
if (loadedPlan !== 'free') {
  setSubscriptionPlan('free');
  chrome.storage.sync.set({ subscriptionPlan: 'free' }, () => {
    handleSubscriptionPlanChange('free');
  });
}
```

**User Comment**: "There will be no situation 'no license key and plan is not Free'. NO license means Free"

**Analysis**:
- ✅ **User is correct** - This is defensive code for an edge case that shouldn't happen
- ⚠️ **Issue**: If this situation occurs, it calls `handleSubscriptionPlanChange('free')` but doesn't fetch packages
- 🔧 **Recommendation**: Remove this check OR if keeping it, also fetch packages for Free plan

---

### 2. **Line 290** - Clearing License Field
```typescript
// No license key - revert to free plan
setSubscriptionPlan('free');
chrome.storage.sync.set({ 
  licenseKey: '',
  subscriptionPlan: 'free' 
}, () => {
  handleSubscriptionPlanChange('free');
});
```

**User Comment**: "When clearing license field the plan should be reverted to 'Free': yes - valid"

**Analysis**:
- ✅ **Valid use case** - User confirmed this is correct
- ⚠️ **Issue**: Calls `handleSubscriptionPlanChange('free')` but doesn't fetch packages from backend
- 🔧 **Recommendation**: After `handleSubscriptionPlanChange('free')`, should also:
  - Set `selectedPackages` to `['generic']` (Free plan only has generic)
  - Optionally call `fetchPackages('')` or set packages directly since Free plan is known

---

### 3. **Line 334** - License Validated Successfully
```typescript
// Save license key and update subscription plan
chrome.storage.sync.set({
  licenseKey: key.trim(),
  subscriptionPlan: data.plan || 'free',
}, () => {
  setLicenseKey(key.trim());
  setSubscriptionPlan(data.plan || 'free');
  // Trigger plan change handler to update settings
  handleSubscriptionPlanChange(data.plan || 'free');
});

// Fetch packages for this license
await fetchPackages(key.trim());
```

**User Comment**: "When license validated and plan set. Selected (purchase) Packages should be pulled along with the plan for this license from the backend (supabase)."

**Analysis**:
- ✅ **Packages are fetched** - `fetchPackages(key.trim())` is called after
- ✅ **Packages are set** - `fetchPackages` sets `selectedPackages` from `data.packages.all_active` (line 235)
- ⚠️ **Order issue**: `handleSubscriptionPlanChange` is called before `fetchPackages`, but this is fine since:
  - `handleSubscriptionPlanChange` only adjusts settings (provider/model/variants/goals/tones)
  - `fetchPackages` sets packages from backend
- 🔧 **Recommendation**: Current order is fine, but could be clearer. Consider:
  - Option A: Keep current order (settings first, then packages)
  - Option B: Fetch packages first, then adjust settings (might be more logical)

---

### 4. **Line 352** - Invalid License
```typescript
// License is invalid - revert to free plan
setSubscriptionPlan('free');
chrome.storage.sync.set({ 
  licenseKey: '',
  subscriptionPlan: 'free' 
}, () => {
  setLicenseKey('');
  handleSubscriptionPlanChange('free');
});
```

**User Comment**: "License is invalid: plan is defaulted to 'Free' and packages set according to the plan rule (from supabase). Both would be refreshed from the backend"

**Analysis**:
- ❌ **Missing**: Doesn't fetch packages from backend
- ❌ **Missing**: Doesn't set `selectedPackages` to `['generic']` for Free plan
- 🔧 **Recommendation**: Should:
  1. Call `handleSubscriptionPlanChange('free')` (adjusts settings)
  2. Set `selectedPackages` to `['generic']` (Free plan only has generic)
  3. Optionally call `fetchPackages('')` to refresh from backend (though Free plan is known)

---

### 5. **Line 367** - License Validation Error
```typescript
// On error, revert to free plan
setSubscriptionPlan('free');
chrome.storage.sync.set({ 
  licenseKey: '',
  subscriptionPlan: 'free' 
}, () => {
  handleSubscriptionPlanChange('free');
});
```

**User Comment**: "Same as 4"

**Analysis**:
- ❌ **Same issues as #4**: Doesn't fetch packages or set selectedPackages
- 🔧 **Recommendation**: Same as #4

---

## Summary of Issues

| Usage | Issue | Fix Needed |
|-------|-------|------------|
| **Line 165** | Defensive code for edge case that shouldn't happen | Remove OR add package fetch |
| **Line 290** | Missing package fetch/set for Free plan | Add `setSelectedPackages(['generic'])` |
| **Line 334** | Order might be suboptimal | Consider reordering (optional) |
| **Line 352** | Missing package fetch/set for Free plan | Add `setSelectedPackages(['generic'])` |
| **Line 367** | Missing package fetch/set for Free plan | Add `setSelectedPackages(['generic'])` |

---

## Recommended Changes

### 1. Remove or Fix Line 165
```typescript
// Option A: Remove entirely (user says this case won't happen)
// Just remove the if block

// Option B: If keeping for safety, add package handling
if (loadedPlan !== 'free') {
  setSubscriptionPlan('free');
  chrome.storage.sync.set({ subscriptionPlan: 'free' }, () => {
    handleSubscriptionPlanChange('free');
    setSelectedPackages(['generic']); // Free plan only has generic
  });
}
```

### 2. Fix Line 290 (Clearing License)
```typescript
setSubscriptionPlan('free');
chrome.storage.sync.set({ 
  licenseKey: '',
  subscriptionPlan: 'free' 
}, () => {
  handleSubscriptionPlanChange('free');
  setSelectedPackages(['generic']); // Free plan only has generic
});
```

### 3. Consider Reordering Line 334 (Optional)
```typescript
// Option A: Current (settings first, then packages) - OK
handleSubscriptionPlanChange(data.plan || 'free');
await fetchPackages(key.trim());

// Option B: Packages first, then settings - might be more logical
await fetchPackages(key.trim());
handleSubscriptionPlanChange(data.plan || 'free');
```

### 4. Fix Line 352 (Invalid License)
```typescript
setSubscriptionPlan('free');
chrome.storage.sync.set({ 
  licenseKey: '',
  subscriptionPlan: 'free' 
}, () => {
  setLicenseKey('');
  handleSubscriptionPlanChange('free');
  setSelectedPackages(['generic']); // Free plan only has generic
});
```

### 5. Fix Line 367 (Validation Error)
```typescript
setSubscriptionPlan('free');
chrome.storage.sync.set({ 
  licenseKey: '',
  subscriptionPlan: 'free' 
}, () => {
  handleSubscriptionPlanChange('free');
  setSelectedPackages(['generic']); // Free plan only has generic
});
```

---

## What `handleSubscriptionPlanChange` Does

Currently, `handleSubscriptionPlanChange`:
1. ✅ Validates and adjusts provider/model based on plan limits
2. ✅ Validates and adjusts numVariants, numGoals, numTones based on plan limits
3. ✅ Resets classificationConfidenceThreshold if downgrading
4. ✅ Updates subscriptionPlan state

**It does NOT**:
- ❌ Fetch packages from backend
- ❌ Set selectedPackages
- ❌ Handle package selection (removed with contentPackagesAllowed)

---

## Recommendation

Since packages are now determined by license (from backend), we should:

1. **Keep `handleSubscriptionPlanChange`** - Still needed for settings validation
2. **Add package handling** to all cases that revert to Free:
   - Set `selectedPackages` to `['generic']` for Free plan
   - Optionally fetch from backend (though Free plan is known)
3. **Remove or simplify Line 165** - User says this case won't happen
4. **Consider helper function** - Create `resetToFreePlan()` that:
   - Sets plan to 'free'
   - Calls `handleSubscriptionPlanChange('free')`
   - Sets `selectedPackages` to `['generic']`
   - Clears license key

---

**Last Updated**: 2026-01-22
