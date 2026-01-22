# How to Get Test License Keys for Phase 4 Testing

**Date**: 2026-01-22  
**Purpose**: Guide for obtaining Pro plan license keys for testing package purchase functionality

---

## Option 1: Use Test Setup Script (Recommended)

### Prerequisites
- Supabase environment variables configured locally
- Access to Supabase database

### Steps

1. **Set Environment Variables**:
```powershell
# Option A: Use setup script (recommended)
cd c:\VScode\responsable-api
.\tests\setup-env.ps1

# Option B: Set manually
$env:SUPABASE_URL = "https://mxqwbawadvfjqogikcxw.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cXdiYXdhZHZmanFvZ2lrY3h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcwODUyNCwiZXhwIjoyMDg0Mjg0NTI0fQ.243u6n7kRt73S5qXgkJh6xlF4DbCd0cPHcsdohxCFEg"
```

2. **Run Test Setup Script**:
```powershell
cd c:\VScode\responsable-api
node tests\setup-test-data.js licenses
```

3. **Output**:
The script will create test licenses for all plans and display the license keys:
```
📋 Setting up test licenses...

  ✅ Created FREE license: XREPL-FREE-XXXXX
  ✅ Created BASIC license: XREPL-BASIC-XXXXX
  ✅ Created PRO license: XREPL-PRO-XXXXX
  ✅ Created ULTIMATE license: XREPL-ULTIMATE-XXXXX

✅ Test licenses setup complete!
```

4. **Use the Pro License Key**:
   - Copy the Pro license key from the output
   - Use it in your tests: `node test-phase4-tasks-1-2.js "XREPL-PRO-XXXXX"`
   - Or activate it in the extension Options page

---

## Option 2: Create License via Stripe Webhook (Test Mode)

### Steps

1. **Use Stripe Test Mode**:
   - Go to Stripe Dashboard → Test Mode
   - Create a test checkout session for Pro plan
   - Complete the checkout with test card: `4242 4242 4242 4242`

2. **License Key Generated**:
   - Stripe webhook will create the license automatically
   - License key will be in format: `XRPL-XXXX-XXXX-XXXX`
   - Check Stripe webhook logs or database for the license key

3. **Alternative: Use Stripe Checkout API**:
```powershell
# Call the checkout endpoint
$body = @{
    plan = "pro"
    email = "test-pro@example.com"
    billingInterval = "monthly"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://xrepl.app/api/subscribe/checkout" `
    -Method POST `
    -Headers @{ "Content-Type" = "application/json" } `
    -Body $body

# Complete checkout in browser, then check webhook logs for license key
```

---

## Option 3: Create License Directly in Database

### Steps

1. **Access Supabase Dashboard**:
   - Go to Supabase Dashboard → SQL Editor
   - Or use Supabase CLI

2. **Get Pro Plan ID**:
```sql
SELECT id, name FROM plans WHERE name = 'pro';
```

3. **Create Customer (if needed)**:
```sql
INSERT INTO customers (email, status)
VALUES ('test-pro@example.com', 'active')
ON CONFLICT (email) DO NOTHING
RETURNING id;
```

4. **Create License**:
```sql
-- Generate license key (format: XRPL-XXXX-XXXX-XXXX)
-- You can use: SELECT 'XRPL-' || upper(substring(md5(random()::text) from 1 for 4)) || '-' || upper(substring(md5(random()::text) from 1 for 4)) || '-' || upper(substring(md5(random()::text) from 1 for 4));

INSERT INTO licenses (
    license_key,
    plan_id,
    customer_id,
    email,
    status,
    expires_at,
    max_devices
)
VALUES (
    'XRPL-TEST-PRO-' || upper(substring(md5(random()::text) from 1 for 8)),
    (SELECT id FROM plans WHERE name = 'pro'),
    (SELECT id FROM customers WHERE email = 'test-pro@example.com'),
    'test-pro@example.com',
    'active',
    NOW() + INTERVAL '1 year',
    10
)
RETURNING license_key;
```

5. **Copy the License Key**:
   - The `RETURNING license_key` will show you the generated key
   - Use this key for testing

---

## Option 4: Use Existing License (If Available)

If you already have a Pro plan license key from previous testing or development:

1. **Check Database**:
```sql
SELECT license_key, email, status, expires_at 
FROM licenses 
WHERE plan_id = (SELECT id FROM plans WHERE name = 'pro')
AND status = 'active'
LIMIT 5;
```

2. **Use the License Key**:
   - Copy any active Pro license key
   - Use it for testing

---

## Quick Test Command

Once you have a Pro license key:

```powershell
# Run automated tests
cd c:\VScode\reponseable
node test-phase4-tasks-1-2.js "YOUR-PRO-LICENSE-KEY-HERE"
```

---

## Verification

To verify your license key works:

```powershell
# Test license validation
$body = @{
    key = "YOUR-PRO-LICENSE-KEY-HERE"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://xrepl.app/api/validate" `
    -Method POST `
    -Headers @{ "Content-Type" = "application/json" } `
    -Body $body

Write-Host "Valid: $($response.valid)"
Write-Host "Plan: $($response.plan)"
```

**Expected Output**:
```
Valid: True
Plan: pro
```

---

## Notes

- **Test Licenses**: Created via `setup-test-data.js` are for testing only
- **Expiration**: Test licenses expire in 1 year (can be extended)
- **Stripe Test Mode**: Always use Stripe test mode for testing purchases
- **Database Access**: Requires Supabase service role key for direct database access

---

## Troubleshooting

### "License key not found"
- Verify license exists in database
- Check license key spelling (case-sensitive)
- Ensure license status is 'active'

### "Invalid plan"
- Verify plan_id matches Pro plan
- Check plans table for correct plan name

### "No available packages"
- Pro plan should have purchasable packages
- Check `package_plan_eligibility` table
- Verify packages exist in `packages` table

---

**Last Updated**: 2026-01-22
