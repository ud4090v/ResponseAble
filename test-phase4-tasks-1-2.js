// Test script for Phase 4 Tasks 1 & 2
// Tests package list API and purchase flow

const BASE_URL = process.env.API_URL || 'https://xrepl.app/api';
const TEST_LICENSE_KEY = process.env.TEST_LICENSE_KEY || '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
};

function recordTest(passed, testName) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    logSuccess(`${testName} - PASSED`);
  } else {
    testResults.failed++;
    logError(`${testName} - FAILED`);
  }
}

// Test 1: Package List API
async function testPackageList(licenseKey) {
  logTest('TC-1.1: Package List API - Valid License');

  if (!licenseKey) {
    logWarning('No license key provided. Skipping test.');
    logInfo('Set TEST_LICENSE_KEY environment variable or pass as argument');
    return false;
  }

  try {
    const response = await fetch(`${BASE_URL}/packages/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey: licenseKey.trim() }),
    });

    const data = await response.json();

    if (!response.ok) {
      logError(`API returned error: ${data.error || response.statusText}`);
      recordTest(false, 'TC-1.1');
      return false;
    }

    // Validate response structure
    const hasValid = typeof data.valid === 'boolean';
    const hasPackages = data.packages && typeof data.packages === 'object';
    const hasIncluded = Array.isArray(data.packages?.included);
    const hasPurchased = Array.isArray(data.packages?.purchased);
    const hasAvailable = Array.isArray(data.packages?.available);
    const hasAllActive = Array.isArray(data.packages?.all_active);

    if (!hasValid) {
      logError('Response missing "valid" field');
      recordTest(false, 'TC-1.1');
      return false;
    }

    if (!data.valid) {
      logError(`License invalid: ${data.error || 'Unknown error'}`);
      recordTest(false, 'TC-1.1');
      return false;
    }

    if (!hasPackages) {
      logError('Response missing "packages" object');
      recordTest(false, 'TC-1.1');
      return false;
    }

    if (!hasIncluded || !hasPurchased || !hasAvailable || !hasAllActive) {
      logError('Response missing required package arrays');
      recordTest(false, 'TC-1.1');
      return false;
    }

    // Log package counts
    logInfo(`Plan: ${data.plan || 'Unknown'}`);
    logInfo(`Included packages: ${data.packages.included.length}`);
    logInfo(`Purchased packages: ${data.packages.purchased.length}`);
    logInfo(`Available packages: ${data.packages.available.length}`);
    logInfo(`All active packages: ${data.packages.all_active.length}`);

    // Log package details
    if (data.packages.included.length > 0) {
      logInfo('Included packages:');
      data.packages.included.forEach(pkg => {
        logInfo(`  - ${pkg.name} (${pkg.status})`);
      });
    }

    if (data.packages.available.length > 0) {
      logInfo('Available packages:');
      data.packages.available.forEach(pkg => {
        logInfo(`  - ${pkg.name} ($${pkg.price_usd.toFixed(2)})`);
      });
    }

    recordTest(true, 'TC-1.1');
    return data;
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    recordTest(false, 'TC-1.1');
    return false;
  }
}

// Test 2: Package List API - Invalid License
async function testPackageListInvalid() {
  logTest('TC-1.6: Package List API - Invalid License');

  try {
    const response = await fetch(`${BASE_URL}/packages/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey: 'invalid-license-key-12345' }),
    });

    const data = await response.json();

    // Should return error for invalid license
    if (response.ok && data.valid) {
      logError('API should reject invalid license key');
      recordTest(false, 'TC-1.6');
      return false;
    }

    if (data.error || !data.valid) {
      logSuccess(`Correctly rejected invalid license: ${data.error || 'Invalid'}`);
      recordTest(true, 'TC-1.6');
      return true;
    }

    recordTest(false, 'TC-1.6');
    return false;
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    recordTest(false, 'TC-1.6');
    return false;
  }
}

// Test 3: Package Purchase API - Valid Request
async function testPackagePurchase(licenseKey, packageId) {
  logTest('TC-2.4: Package Purchase API - Create Checkout Session');

  if (!licenseKey) {
    logWarning('No license key provided. Skipping test.');
    return false;
  }

  if (!packageId) {
    logWarning('No package ID provided. Skipping test.');
    logInfo('This test requires a valid package ID from available packages');
    return false;
  }

  try {
    // Get options page URL (for success/cancel URLs)
    const successUrl = 'https://xrepl.app/options.html?purchase=success';
    const cancelUrl = 'https://xrepl.app/options.html?purchase=cancel';

    const response = await fetch(`${BASE_URL}/packages/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseKey: licenseKey.trim(),
        packageId: packageId,
        successUrl: successUrl,
        cancelUrl: cancelUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logError(`API returned error: ${data.error || response.statusText}`);
      
      // Check for expected errors
      if (data.error && data.error.includes('already have')) {
        logWarning('Package already purchased - this is expected if testing again');
        recordTest(true, 'TC-2.4 (Already Purchased)');
        return true;
      }
      
      if (data.error && data.error.includes('Pro plan')) {
        logWarning('License is not Pro plan - purchase requires Pro plan');
        recordTest(true, 'TC-2.4 (Non-Pro Plan)');
        return true;
      }

      recordTest(false, 'TC-2.4');
      return false;
    }

    // Validate response structure
    if (!data.success) {
      logError('Response missing "success: true"');
      recordTest(false, 'TC-2.4');
      return false;
    }

    if (!data.checkout_url) {
      logError('Response missing "checkout_url"');
      recordTest(false, 'TC-2.4');
      return false;
    }

    if (!data.session_id) {
      logError('Response missing "session_id"');
      recordTest(false, 'TC-2.4');
      return false;
    }

    logSuccess(`Checkout session created: ${data.session_id}`);
    logInfo(`Checkout URL: ${data.checkout_url}`);
    logWarning('⚠️  Do not complete the checkout in test mode unless testing full flow');

    recordTest(true, 'TC-2.4');
    return data;
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    recordTest(false, 'TC-2.4');
    return false;
  }
}

// Test 4: Package Purchase API - Invalid License
async function testPackagePurchaseInvalid() {
  logTest('TC-2.3: Package Purchase API - Invalid License');

  try {
    const response = await fetch(`${BASE_URL}/packages/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseKey: 'invalid-license-key',
        packageId: 'test-package-id',
        successUrl: 'https://xrepl.app/success',
        cancelUrl: 'https://xrepl.app/cancel',
      }),
    });

    const data = await response.json();

    // Should return error for invalid license
    if (response.ok && data.success) {
      logError('API should reject invalid license key');
      recordTest(false, 'TC-2.3');
      return false;
    }

    if (data.error || !data.success) {
      logSuccess(`Correctly rejected invalid license: ${data.error || 'Invalid'}`);
      recordTest(true, 'TC-2.3');
      return true;
    }

    recordTest(false, 'TC-2.3');
    return false;
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    recordTest(false, 'TC-2.3');
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  Phase 4 Tasks 1 & 2 - API Test Suite', 'cyan');
  log('═══════════════════════════════════════════════════════════\n', 'cyan');

  const licenseKey = process.argv[2] || TEST_LICENSE_KEY;

  if (!licenseKey) {
    logWarning('No license key provided!');
    logInfo('Usage: node test-phase4-tasks-1-2.js <license-key>');
    logInfo('Or set TEST_LICENSE_KEY environment variable\n');
    
    // Run tests that don't require license key
    await testPackageListInvalid();
    await testPackagePurchaseInvalid();
  } else {
    logInfo(`Using license key: ${licenseKey.substring(0, 8)}...`);
    
    // Run all tests
    const packageData = await testPackageList(licenseKey);
    await testPackageListInvalid();
    await testPackagePurchaseInvalid();

    // If we got package data and have available packages, test purchase
    if (packageData && packageData.packages && packageData.packages.available.length > 0) {
      const firstAvailablePackage = packageData.packages.available[0];
      logInfo(`\nTesting purchase with package: ${firstAvailablePackage.name} (${firstAvailablePackage.id})`);
      await testPackagePurchase(licenseKey, firstAvailablePackage.id);
    } else {
      logWarning('No available packages found. Skipping purchase test.');
      logInfo('Purchase test requires Pro plan with available packages.');
    }
  }

  // Print summary
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  Test Results Summary', 'cyan');
  log('═══════════════════════════════════════════════════════════\n', 'cyan');
  
  log(`Total Tests: ${testResults.total}`, 'blue');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(1)
    : 0;
  
  log(`Pass Rate: ${passRate}%\n`, passRate === '100.0' ? 'green' : 'yellow');

  if (testResults.failed === 0) {
    logSuccess('All tests passed! ✅\n');
  } else {
    logError(`${testResults.failed} test(s) failed. Please review the errors above.\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
