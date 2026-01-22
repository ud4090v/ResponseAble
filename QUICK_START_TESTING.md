# Quick Start: Testing Phase 4 Tasks 1 & 2

**Date**: 2026-01-22  
**Purpose**: Quick reference for getting started with testing

---

## 🚀 Fastest Way to Get Started

### Step 1: Create Test License Keys

```powershell
# Navigate to API directory
cd c:\VScode\responsable-api

# Option A: Use setup script (recommended)
.\tests\setup-env.ps1

# Option B: Set manually
$env:SUPABASE_URL = "https://mxqwbawadvfjqogikcxw.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cXdiYXdhZHZmanFvZ2lrY3h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwODUyNCwiZXhwIjoyMDg0Mjg0NTI0fQ.243u6n7kRt73S5qXgkJh6xlF4DbCd0cPHcsdohxCFEg"

# Create test licenses for all plans
node tests\setup-test-data.js licenses
```

**Output Example**:
```
📋 Setting up test licenses...

  ✅ Created FREE license: XREPL-FREE-ABC123
  ✅ Created BASIC license: XREPL-BASIC-DEF456
  ✅ Created PRO license: XREPL-PRO-GHI789
  ✅ Created ULTIMATE license: XREPL-ULTIMATE-JKL012

✅ Test licenses setup complete!
```

**Copy the Pro license key** (e.g., `XREPL-PRO-GHI789`)

---

### Step 2: Run Automated API Tests

```powershell
# Navigate to extension directory
cd c:\VScode\reponseable

# Run tests with Pro license key
node test-phase4-tasks-1-2.js "XREPL-PRO-GHI789"
```

**Expected Output**:
- ✅ TC-1.1: Package List API - Valid License
- ✅ TC-1.6: Package List API - Invalid License
- ✅ TC-2.3: Package Purchase API - Invalid License
- ✅ TC-2.4: Package Purchase API - Create Checkout Session

---

### Step 3: Manual UI Testing

1. **Load Extension**:
   - Open Chrome → `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `c:\VScode\reponseable\build` directory

2. **Open Options Page**:
   - Right-click extension icon → "Options"
   - Or: `chrome://extensions` → Find extension → "Options"

3. **Test License Activation**:
   - Enter Pro license key: `XREPL-PRO-GHI789`
   - Click "Activate License"
   - Verify packages load

4. **Test Package Purchase**:
   - Find available package
   - Click "Purchase $X.XX" button
   - Complete Stripe checkout (test card: `4242 4242 4242 4242`)

**See**: `PHASE4_MANUAL_TESTING_GUIDE.md` for detailed steps

---

## 📋 Test Checklist

### Automated Tests
- [ ] Run `test-phase4-tasks-1-2.js` with Pro license key
- [ ] Verify all 4 tests pass

### Manual UI Tests
- [ ] Options page loads
- [ ] License activation works
- [ ] Packages section displays correctly
- [ ] Purchase button works
- [ ] Stripe checkout redirects
- [ ] Success/cancel flows work

---

## 🔑 Where to Get Supabase Credentials

### Option 1: Vercel Dashboard
1. Go to Vercel Dashboard
2. Select your project (`responsable-api`)
3. Go to Settings → Environment Variables
4. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Option 2: Supabase Dashboard
1. Go to Supabase Dashboard
2. Select your project
3. Go to Settings → API
4. Copy "Project URL" (SUPABASE_URL)
5. Copy "service_role" key (SUPABASE_SERVICE_ROLE_KEY)

---

## ⚠️ Important Notes

- **Test Mode Only**: Always use Stripe test mode for purchases
- **Test Card**: Use `4242 4242 4242 4242` for Stripe checkout
- **License Format**: Test licenses are in format `XREPL-PLAN-XXXXX`
- **Expiration**: Test licenses expire in 1 year (can be extended)

---

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
- See "Where to Get Supabase Credentials" above

### "License key not found"
- Verify license was created successfully
- Check database: `SELECT * FROM licenses WHERE license_key = 'YOUR-KEY'`

### "No available packages"
- Pro plan should show purchasable packages
- Check `package_plan_eligibility` table in database
- Verify packages exist in `packages` table

---

## 📚 Related Documentation

- **`HOW_TO_GET_TEST_LICENSE_KEYS.md`** - Detailed guide for all methods
- **`PHASE4_MANUAL_TESTING_GUIDE.md`** - Step-by-step manual testing
- **`PHASE4_TASKS_1_2_TEST_PLAN.md`** - Complete test plan
- **`PHASE4_TEST_EXECUTION_SUMMARY.md`** - Test results summary

---

**Last Updated**: 2026-01-22
