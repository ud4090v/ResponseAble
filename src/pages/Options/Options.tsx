import React, { useState, useEffect } from 'react';
import './Options.css';
import { VERCEL_PROXY_URL } from '../../config/apiKeys.js';
import UsageDisplay from '../../components/UsageDisplay';

interface Props {
  title: string;
}

interface ApiConfig {
  provider: string;
  model: string;
  numVariants: number;
  numGoals: number;
  numTones: number;
  classificationConfidenceThreshold: number;
  enableStyleMimicking: boolean;
}

interface Package {
  name: string;
  base?: boolean;
  description: string;
  intent: string;
  userIntent: string;
  roleDescription: string;
  contextSpecific: string;
}

interface SubscriptionPlan {
  name: string;
  tier: number;
  maxGoals: number;
  maxVariants: number;
  maxTones: number;
  maxGenerationsPerMonth: number;
  availableProviders: string[];
  availableModels: {
    [key: string]: string[];
  };
  allContent: boolean;
  styleMimickingEnabled: boolean;
  classificationConfidenceEnabled: boolean;
}

// Plans will be loaded from API

// Display names for known providers (used for dropdown labels only)
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  grok: 'Grok (xAI)',
  claude: 'Claude (Anthropic)',
  anthropic: 'Claude (Anthropic)',
};

// Helper to get a display name for a provider code
const getProviderDisplayName = (code: string): string => {
  return PROVIDER_DISPLAY_NAMES[code] || code.charAt(0).toUpperCase() + code.slice(1);
};

const Options: React.FC<Props> = ({ title }: Props) => {
  const [activeTab, setActiveTab] = useState<string>('models');
  const [config, setConfig] = useState<ApiConfig>({
    provider: 'grok',
    model: 'grok-4-latest',
    numVariants: 4,
    numGoals: 3,
    numTones: 3,
    classificationConfidenceThreshold: 0.85,
    enableStyleMimicking: true,
  });
  const [selectedPackages, setSelectedPackages] = useState<string[]>(['generic']);
  const [defaultRole, setDefaultRole] = useState<string>('generic');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('free');
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [saved, setSaved] = useState(false);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [licenseStatus, setLicenseStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
    plan?: string;
    expiresAt?: string;
  }>({ status: 'idle', message: '' });
  const [packagesData, setPackagesData] = useState<{
    included: Array<{ id: string; name: string; title?: string | null; details?: string | null; description: string; status: string }>;
    purchased: Array<{ id: string; name: string; title?: string | null; details?: string | null; description: string; status: string; payment_status?: string }>;
    available: Array<{ id: string; name: string; title?: string | null; details?: string | null; description: string; price_usd: number }>;
    all_active: string[];
  } | null>(null);
  const [packagesLoading, setPackagesLoading] = useState<boolean>(false);
  const [overageEnabled, setOverageEnabled] = useState<boolean>(true);
  const [overageLoading, setOverageLoading] = useState<boolean>(false);

  useEffect(() => {
    // Get icon URL
    try {
      const url = chrome.runtime.getURL('xReplAI-brandw.png');
      setIconUrl(url);
    } catch (error) {
      console.error('Failed to get icon URL:', error);
    }

    // Load plans from API
    fetchPlans();

    // Handle purchase success/cancel from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const purchaseStatus = urlParams.get('purchase');
    const packageName = urlParams.get('package');

    if (purchaseStatus === 'success' && packageName) {
      // Show success message
      alert(`Successfully purchased ${packageName} package! Refreshing packages...`);
      // Refresh packages if license is active
      if (licenseKey && licenseKey.trim().length > 0) {
        fetchPackages(licenseKey);
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (purchaseStatus === 'cancel') {
      // Show cancel message (optional, can be silent)
      console.log('Package purchase was cancelled');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Load saved settings
    chrome.storage.sync.get(['apiProvider', 'apiModel', 'numVariants', 'numGoals', 'numTones', 'classificationConfidenceThreshold', 'enableStyleMimicking', 'selectedPackages', 'defaultRole', 'subscriptionPlan', 'licenseKey'], (result) => {
      // Load subscription plan, default to 'free' if not set
      const loadedPlan = result.subscriptionPlan && typeof result.subscriptionPlan === 'string' ? result.subscriptionPlan : 'free';
      setSubscriptionPlan(loadedPlan);

      setConfig({
        provider: result.apiProvider || 'grok',
        model: result.apiModel || 'grok-4-latest',
        numVariants: result.numVariants || 4,
        numGoals: result.numGoals || 3,
        numTones: result.numTones || 3,
        classificationConfidenceThreshold: result.classificationConfidenceThreshold !== undefined ? result.classificationConfidenceThreshold : 0.85,
        enableStyleMimicking: result.enableStyleMimicking !== undefined ? result.enableStyleMimicking : true,
      });
      // Load selected packages, default to ['generic'] if none selected
      if (result.selectedPackages && Array.isArray(result.selectedPackages) && result.selectedPackages.length > 0) {
        setSelectedPackages(result.selectedPackages);
      } else {
        setSelectedPackages(['generic']);
      }
      // Load default role, default to 'generic' if not found
      const loadedDefaultRole = result.defaultRole && typeof result.defaultRole === 'string' ? result.defaultRole : 'generic';
      // Validate that loaded default role is in selected packages
      const loadedPackages = result.selectedPackages && Array.isArray(result.selectedPackages) && result.selectedPackages.length > 0
        ? result.selectedPackages
        : ['generic'];
      setDefaultRole(loadedPackages.includes(loadedDefaultRole) ? loadedDefaultRole : 'generic');
      
      // Load license key if exists
      if (result.licenseKey) {
        setLicenseKey(result.licenseKey);
        // Validate license on load (this will also fetch packages)
        validateLicenseKey(result.licenseKey, false);
        // Fetch overage setting
        fetchOverageSetting();
      }
      // Note: No license key always means Free plan - no need for defensive check
    });
  }, []);

  /**
   * Fetch subscription plans from API
   */
  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const response = await fetch(`${VERCEL_PROXY_URL}/plans/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.plans) {
        setSubscriptionPlans(data.plans);
        
        // Cache plans in storage for Content Script
        chrome.storage.local.set({
          cachedPlans: data.plans,
          cachedPlansTimestamp: Date.now(),
        });
      } else {
        console.error('Failed to fetch plans:', data);
        // Fallback to empty array - will use defaults
        setSubscriptionPlans([]);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      // Fallback to empty array - will use defaults
      setSubscriptionPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  /**
   * Fetch packages for the current license
   * @param key - License key
   */
  const fetchPackages = async (key: string) => {
    if (!key || key.trim().length === 0) {
      setPackagesData(null);
      return;
    }

    setPackagesLoading(true);
    try {
      const response = await fetch(`${VERCEL_PROXY_URL}/packages/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey: key.trim() }),
      });

      const data = await response.json();

      if (data.valid && data.packages) {
        setPackagesData(data.packages);
        // Update selected packages based on active packages from API
        // Only use all_active if it contains packages the user actually owns (included or purchased)
        const ownedPackages = [
          ...(data.packages.included?.map((p: any) => p.name) || []),
          ...(data.packages.purchased?.map((p: any) => p.name) || [])
        ];
        // Always include generic (base package)
        const activePackages = ownedPackages.length > 0 
          ? (ownedPackages.includes('generic') ? ownedPackages : ['generic', ...ownedPackages])
          : ['generic'];
        setSelectedPackages(activePackages);
        
        // Set default role intelligently: prefer first non-generic package, otherwise generic
        // Only update if current defaultRole is not in the new packages list
        setDefaultRole((currentRole) => {
          if (activePackages.includes(currentRole)) {
            return currentRole; // Keep current if it's still valid
          }
          // Find first non-generic package, or fall back to generic
          const firstNonGeneric = activePackages.find(pkg => pkg !== 'generic');
          return firstNonGeneric || 'generic';
        });
        
        // Cache full package definitions for Content Script
        // Fetch full definitions and cache them
        try {
          const definitionsResponse = await fetch(`${VERCEL_PROXY_URL}/packages/definitions`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (definitionsResponse.ok) {
            const definitionsData = await definitionsResponse.json();
            if (definitionsData.success && definitionsData.packages) {
              // Cache in storage for Content Script to use
              chrome.storage.local.set({
                cachedPackages: definitionsData.packages,
                cachedPackagesTimestamp: Date.now(),
              });
            }
          }
        } catch (error) {
          console.warn('Failed to cache package definitions:', error);
          // Non-critical - Content Script will fetch directly if needed
        }
      } else {
        setPackagesData(null);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setPackagesData(null);
    } finally {
      setPackagesLoading(false);
    }
  };

  /**
   * Validate license key with the API
   * @param key - License key to validate
   * @param saveOnSuccess - Whether to save key to storage if valid
   */
  const validateLicenseKey = async (key: string, saveOnSuccess: boolean = true) => {
    if (!key || key.trim().length === 0) {
      setLicenseStatus({
        status: 'error',
        message: 'Please enter a license key. Get access at https://xrepl.ai/pricing',
      });
      // No license key - revert to free plan
      resetToFreePlan();
      return;
    }

    setLicenseStatus({
      status: 'loading',
      message: 'Validating license key...',
    });

    try {
      // Call validation API
      const response = await fetch(`${VERCEL_PROXY_URL}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: key.trim() }),
      });

      const data = await response.json();

      if (data.valid) {
        // License is valid
        const expiresDate = data.expires_at ? new Date(data.expires_at).toLocaleDateString() : 'N/A';
        const planDisplay = data.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : 'Unknown';
        
        setLicenseStatus({
          status: 'success',
          message: `Active ${planDisplay} – expires ${expiresDate}`,
          plan: data.plan,
          expiresAt: data.expires_at,
        });

        // Save license key and update subscription plan
        if (saveOnSuccess) {
          // Fetch packages first (they determine what's available)
          await fetchPackages(key.trim());
          // Fetch overage setting
          await fetchOverageSetting();
          
          // Then update plan and adjust settings based on plan limits
          chrome.storage.sync.set({
            licenseKey: key.trim(),
            subscriptionPlan: data.plan || 'free',
          }, () => {
            // Update local state
            setLicenseKey(key.trim());
            setSubscriptionPlan(data.plan || 'free');
            // Trigger plan change handler to update settings (provider/model/variants/goals/tones)
            handleSubscriptionPlanChange(data.plan || 'free');
          });
        } else {
          // If not saving, still fetch packages for display
          await fetchPackages(key.trim());
        }
      } else {
        // License is invalid - revert to free plan
        setLicenseStatus({
          status: 'error',
          message: data.error || 'Invalid license key',
        });
        resetToFreePlan();
      }
    } catch (error) {
      console.error('License validation error:', error);
      setLicenseStatus({
        status: 'error',
        message: 'Failed to validate license. Please check your connection.',
      });
      // On error, revert to free plan
      resetToFreePlan();
    }
  };

  /**
   * Handle license key activation
   */
  const handleActivateLicense = () => {
    validateLicenseKey(licenseKey, true);
  };

  /**
   * Fetch current overage setting from usage API
   */
  const fetchOverageSetting = async () => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      return;
    }

    try {
      const response = await fetch(`${VERCEL_PROXY_URL}/usage-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.overage) {
          setOverageEnabled(data.overage.enabled);
        }
      }
    } catch (error) {
      console.error('Error fetching overage setting:', error);
    }
  };

  /**
   * Update overage enabled setting
   */
  const updateOverageSetting = async (enabled: boolean) => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      alert('Please activate your license key first.');
      return;
    }

    setOverageLoading(true);
    try {
      const response = await fetch(`${VERCEL_PROXY_URL}/update-overage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          overageEnabled: enabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOverageEnabled(data.overage_enabled);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const error = await response.json();
        alert(`Failed to update overage setting: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating overage setting:', error);
      alert('Failed to update overage setting. Please try again.');
    } finally {
      setOverageLoading(false);
    }
  };

  /**
   * Handle package purchase
   * @param packageId - Package ID to purchase
   * @param packageName - Package name for display
   */
  const handlePackagePurchase = async (packageId: string, packageName: string) => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      alert('Please activate your license key first.');
      return;
    }

    if (licenseStatus.status !== 'success') {
      alert('Please ensure your license key is valid before purchasing packages.');
      return;
    }

    // Confirm purchase
    const confirmed = confirm(`Purchase ${packageName} package? You will be redirected to Stripe checkout.`);
    if (!confirmed) {
      return;
    }

    try {
      // Get current extension options page URL for success/cancel redirects
      const optionsPageUrl = chrome.runtime.getURL('options.html');
      const successUrl = `${optionsPageUrl}?purchase=success&package=${packageName}`;
      const cancelUrl = `${optionsPageUrl}?purchase=cancel`;

      // Call purchase API
      const response = await fetch(`${VERCEL_PROXY_URL}/packages/purchase`, {
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

      if (data.success && data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = data.checkout_url;
      } else {
        alert(data.error || 'Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Package purchase error:', error);
      alert('Failed to initiate purchase. Please check your connection and try again.');
    }
  };

  // Auto-reset default role to generic if it's not in selected packages
  useEffect(() => {
    if (!selectedPackages.includes(defaultRole)) {
      setDefaultRole('generic');
    }
  }, [selectedPackages, defaultRole]);

  const getCurrentPlan = (): SubscriptionPlan | undefined => {
    return subscriptionPlans.find(p => p.name === subscriptionPlan);
  };

  /**
   * Reset to Free plan - clears license and sets packages to generic only
   */
  const resetToFreePlan = () => {
    setLicenseKey('');
    setSubscriptionPlan('free');
    setSelectedPackages(['generic']); // Free plan only has generic package
    setLicenseStatus({ status: 'idle', message: '' });
    chrome.storage.sync.set({ 
      licenseKey: '',
      subscriptionPlan: 'free',
      selectedPackages: ['generic']
    }, () => {
      handleSubscriptionPlanChange('free');
    });
  };

  const handleSubscriptionPlanChange = (planName: string) => {
    // Wait for plans to load
    if (plansLoading || subscriptionPlans.length === 0) {
      console.warn('Plans not loaded yet, cannot change plan');
      return;
    }
    
    const newPlan = subscriptionPlans.find(p => p.name === planName);
    if (!newPlan) {
      console.warn(`Plan ${planName} not found`);
      return;
    }

    const oldPlan = getCurrentPlan();
    const oldTier = oldPlan?.tier || 0;
    const newTier = newPlan.tier;

    // Note: Packages are now determined by license, not by plan selection
    // This function only handles provider/model settings and validation limits

    // Handle provider/model/numVariants validation
    let updatedConfig = { ...config };

    // Check provider
    if (!newPlan.availableProviders.includes(config.provider)) {
      // Provider not available in new plan, reset to first available
      const firstProvider = newPlan.availableProviders[0] || 'grok';
      const firstModel = newPlan.availableModels[firstProvider]?.[0] || '';
      updatedConfig.provider = firstProvider;
      updatedConfig.model = firstModel;
    } else {
      // Provider is available, check if model is valid
      const availableModels = newPlan.availableModels[config.provider] || [];
      if (!availableModels.includes(config.model)) {
        // Model not available, reset to first available model for provider
        const firstModel = availableModels[0] || '';
        updatedConfig.model = firstModel;
      }
    }

    // Handle numVariants validation - adjust if current value exceeds new plan's maxVariants
    if (config.numVariants > newPlan.maxVariants) {
      updatedConfig.numVariants = newPlan.maxVariants;
    }

    // Handle numGoals validation - adjust if current value exceeds new plan's maxGoals
    if (config.numGoals > newPlan.maxGoals) {
      updatedConfig.numGoals = newPlan.maxGoals;
    }

    // Handle numTones validation - adjust if current value exceeds new plan's maxTones
    if (config.numTones > newPlan.maxTones) {
      updatedConfig.numTones = newPlan.maxTones;
    }

    // Handle classificationConfidenceThreshold - reset to 0.85 if downgrading to a plan that doesn't support it
    if (!newPlan.classificationConfidenceEnabled && oldPlan?.classificationConfidenceEnabled) {
      updatedConfig.classificationConfidenceThreshold = 0.85;
    }

    // Apply all config updates at once
    if (updatedConfig.provider !== config.provider || updatedConfig.model !== config.model ||
      updatedConfig.numVariants !== config.numVariants || updatedConfig.numGoals !== config.numGoals ||
      updatedConfig.numTones !== config.numTones || updatedConfig.classificationConfidenceThreshold !== config.classificationConfidenceThreshold) {
      setConfig(updatedConfig);
    }

    setSubscriptionPlan(planName);
  };

  const handleProviderChange = (provider: ApiConfig['provider']) => {
    const currentPlan = getCurrentPlan();
    if (currentPlan && !currentPlan.availableProviders.includes(provider)) {
      // Provider not available in current plan, don't allow change
      return;
    }

    // Get available models for the provider from current plan
    const availableModels = currentPlan?.availableModels[provider] || [];
    const firstModel = availableModels[0] || '';

    setConfig({
      ...config,
      provider,
      model: firstModel, // Set to first available model of new provider
    });
  };

  const handlePackageToggle = (packageName: string) => {
    setSelectedPackages((prev) => {
      if (prev.includes(packageName)) {
        // If unchecking the last package, ensure at least 'generic' is selected
        const newSelection = prev.filter((p) => p !== packageName);
        const finalSelection = newSelection.length > 0 ? newSelection : ['generic'];

        // If default role is being removed, reset to generic
        if (packageName === defaultRole && !finalSelection.includes(defaultRole)) {
          setDefaultRole('generic');
        }

        return finalSelection;
      } else {
        return [...prev, packageName];
      }
    });
  };

  const handleSave = () => {
    // Validate numVariants (must be between 1 and maxVariants from subscription plan)
    const maxVariants = currentPlan?.maxVariants || 7;
    const validatedNumVariants = Math.max(1, Math.min(maxVariants, config.numVariants));

    // Validate numGoals (must be between 1 and maxGoals from subscription plan)
    const maxGoals = currentPlan?.maxGoals || 5;
    const validatedNumGoals = Math.max(1, Math.min(maxGoals, config.numGoals));

    // Validate numTones (must be between 1 and maxTones from subscription plan)
    const maxTones = currentPlan?.maxTones || 5;
    const validatedNumTones = Math.max(1, Math.min(maxTones, config.numTones));

    // Ensure at least one package is selected (default to generic)
    const packagesToSave = selectedPackages.length > 0 ? selectedPackages : ['generic'];

    // Validate default role - must be in selected packages, or default to generic
    const validatedDefaultRole = packagesToSave.includes(defaultRole) ? defaultRole : 'generic';

    // Validate confidence threshold (must be between 0.0 and 1.0)
    const validatedConfidenceThreshold = Math.max(0.0, Math.min(1.0, config.classificationConfidenceThreshold));

    chrome.storage.sync.set(
      {
        apiProvider: config.provider,
        apiModel: config.model,
        numVariants: validatedNumVariants,
        numGoals: validatedNumGoals,
        numTones: validatedNumTones,
        classificationConfidenceThreshold: validatedConfidenceThreshold,
        enableStyleMimicking: config.enableStyleMimicking,
        selectedPackages: packagesToSave,
        defaultRole: validatedDefaultRole,
        subscriptionPlan: subscriptionPlan,
        licenseKey: licenseKey.trim(),
      },
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    );
  };

  const currentPlan = getCurrentPlan();
  const availableProvidersForPlan = currentPlan?.availableProviders || ['openai', 'grok'];
  const availableModelsForProvider = currentPlan?.availableModels[config.provider] || [];

  // Show Default Role tab if user has multiple packages OR has at least one non-generic package
  const hasNonGenericPackages = selectedPackages.some(pkg => pkg !== 'generic');
  const showDefaultRoleTab = selectedPackages.length > 1 || hasNonGenericPackages;

  // Map package name -> user-facing title (for Default Role dropdown and any UI that only has name)
  const packageTitleByName = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (packagesData) {
      const all = [...(packagesData.included || []), ...(packagesData.purchased || [])];
      all.forEach((p: { name: string; title?: string | null }) => {
        map[p.name] = (p.title && p.title.trim()) ? p.title : (p.name ? p.name.charAt(0).toUpperCase() + p.name.slice(1) : '—');
      });
    }
    if (!map['generic']) map['generic'] = 'General';
    return map;
  }, [packagesData]);

  return (
    <div className="OptionsContainer">
      <div className="OptionsContent">
        <h1 className="OptionsPageTitle">
          {iconUrl && (
            <img
              src={iconUrl}
              alt="xReplAI"
              className="OptionsPageTitleBrandImg"
            />
          )}
          <span className="OptionsPageTitleSub">Settings</span>
        </h1>

        {/* License Key Section - Always visible at top */}
        <div className="SettingsSection LicenseSection">
          <h2>License Activation</h2>
          <p className="HelpTextPlain">
            Enter your license key to activate your subscription. Your license key was sent to your email after purchase.
          </p>
          <div className="SettingGroup">
            <label htmlFor="license-key">License Key:</label>
            <div className="FlexRow">
              <input
                id="license-key"
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XRPL-XXXX-XXXX-XXXX"
                className="LicenseInput"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && licenseKey.trim()) {
                    handleActivateLicense();
                  }
                }}
              />
              {(!licenseKey || !licenseKey.trim()) ? (
                <a
                  href="https://xrepl.ai/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="SaveButton"
                >
                  Get Access
                </a>
              ) : (
                <button
                  type="button"
                  className="SaveButton"
                  onClick={handleActivateLicense}
                  disabled={licenseStatus.status === 'loading'}
                >
                  {licenseStatus.status === 'loading' ? (
                    <span className="SpinnerRow">
                      <span className="Spinner" />
                      Validating...
                    </span>
                  ) : (
                    'Activate'
                  )}
                </button>
              )}
            </div>
            
            {/* Status Display */}
            {licenseStatus.status !== 'idle' && (
              <div
                className={`LicenseStatusBox LicenseStatusBox--${
                  licenseStatus.status === 'success'
                    ? 'success'
                    : licenseStatus.status === 'error'
                    ? 'error'
                    : 'loading'
                }`}
              >
                {licenseStatus.status === 'success' && (
                  <span className="LicenseStatusIcon">✓</span>
                )}
                {licenseStatus.status === 'error' && (
                  <span className="LicenseStatusIcon">✗</span>
                )}
                <span>{licenseStatus.message}</span>
                {licenseStatus.status === 'error' && (
                  <a
                    href="https://xrepl.ai/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="LicenseStatusLink"
                  >
                    Get Access
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="TabsContainer">
          <button
            className={`Tab ${activeTab === 'models' ? 'TabActive' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            Models
          </button>
          <button
            className={`Tab ${activeTab === 'generation' ? 'TabActive' : ''}`}
            onClick={() => setActiveTab('generation')}
          >
            Generation
          </button>
          <button
            className={`Tab ${activeTab === 'packages' ? 'TabActive' : ''}`}
            onClick={() => setActiveTab('packages')}
          >
            Subscription
          </button>
          {showDefaultRoleTab && (
            <button
              className={`Tab ${activeTab === 'defaultRole' ? 'TabActive' : ''}`}
              onClick={() => setActiveTab('defaultRole')}
            >
              Default Role
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="TabContent">
          {/* Models Tab */}
          {activeTab === 'models' && (
        <div className="SettingsSection">
          <h2>API Configuration</h2>
          <p className="HelpText HelpTextSection">
            Select your preferred AI provider and model. API keys are managed by the extension developer.
          </p>

          <div className="SettingGroup">
            <label htmlFor="api-provider">API Provider:</label>
            <select
              id="api-provider"
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
                  {availableProvidersForPlan.map((providerCode: string) => (
                <option key={providerCode} value={providerCode}>
                  {getProviderDisplayName(providerCode)}
                </option>
              ))}
            </select>
          </div>

          <div className="SettingGroup">
            <label htmlFor="api-model">Model:</label>
            <select
              id="api-model"
              value={config.model}
                  onChange={(e) => {
                    // Validate model is available for current plan
                    if (availableModelsForProvider.includes(e.target.value)) {
                      setConfig({ ...config, model: e.target.value });
                    }
                  }}
            >
              {availableModelsForProvider.map((model: string) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

            </div>
          )}

          {/* Generation Tab */}
          {activeTab === 'generation' && (
            <div className="SettingsSection">
              <h2>Generation Preferences</h2>
              <p className="HelpText HelpTextSection">
                Configure preferences for draft generation and email classification.
              </p>

              <div className="SettingGroup">
            <label htmlFor="num-variants">Number of Variants:</label>
            <input
              id="num-variants"
              type="number"
              min="1"
              max={currentPlan?.maxVariants || 7}
              value={config.numVariants}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                const maxVariants = currentPlan?.maxVariants || 7;
                if (!isNaN(value) && value >= 1 && value <= maxVariants) {
                  setConfig({ ...config, numVariants: value });
                }
              }}
              className="SettingInputNumber"
            />
            <p className="HelpText HelpTextInline">
                  Number of response variants to generate (1-{currentPlan?.maxVariants || 7})
                  {currentPlan && ` - Your ${currentPlan.name.charAt(0).toUpperCase() + currentPlan.name.slice(1)} plan allows up to ${currentPlan.maxVariants} variants`}
                </p>
              </div>

              <div className="SettingGroup">
                <label htmlFor="num-goals">Number of Goals:</label>
                <input
                  id="num-goals"
                  type="number"
                  min="1"
                  max={currentPlan?.maxGoals || 5}
                  value={config.numGoals}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    const maxGoals = currentPlan?.maxGoals || 5;
                    if (!isNaN(value) && value >= 1 && value <= maxGoals) {
                      setConfig({ ...config, numGoals: value });
                    }
                  }}
                  className="SettingInputNumber"
                />
                <p className="HelpText HelpTextInline">
                  Number of response goals to generate (1-{currentPlan?.maxGoals || 5})
                  {currentPlan && ` - Your ${currentPlan.name.charAt(0).toUpperCase() + currentPlan.name.slice(1)} plan allows up to ${currentPlan.maxGoals} goals`}
                </p>
              </div>

              <div className="SettingGroup">
                <label htmlFor="num-tones">Number of Tones:</label>
                <input
                  id="num-tones"
                  type="number"
                  min="1"
                  max={currentPlan?.maxTones || 5}
                  value={config.numTones}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    const maxTones = currentPlan?.maxTones || 5;
                    if (!isNaN(value) && value >= 1 && value <= maxTones) {
                      setConfig({ ...config, numTones: value });
                    }
                  }}
                  className="SettingInputNumber"
                />
                <p className="HelpText HelpTextInline">
                  Number of tone options to generate (1-{currentPlan?.maxTones || 5})
                  {currentPlan && ` - Your ${currentPlan.name.charAt(0).toUpperCase() + currentPlan.name.slice(1)} plan allows up to ${currentPlan.maxTones} tones`}
                </p>
              </div>

              {/* Minimum Classification Confidence - Only show for plans with classificationConfidenceEnabled */}
              {currentPlan && currentPlan.classificationConfidenceEnabled && (
                <div className="SettingGroup">
                  <label htmlFor="confidence-threshold">Minimum Classification Confidence:</label>
                  <div className="FlexRowCenter">
                    <input
                      id="confidence-threshold"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.classificationConfidenceThreshold}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 1) {
                          setConfig({ ...config, classificationConfidenceThreshold: value });
                        }
                      }}
                      className="ConfidenceSlider"
                    />
                    <span className="ConfidenceValue">
                      {(config.classificationConfidenceThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="HelpText HelpTextInline">
                    If classification confidence is below this threshold, the system will use Generic package. Higher values = stricter matching (0.0-1.0, default: 0.85)
                  </p>
                </div>
              )}

              {/* Style Mimicking Toggle - Show for all plans, but disabled for Free/Basic */}
              <div className="SettingGroup">
                <label
                  htmlFor="style-mimicking"
                  className={`CheckboxLabel${!currentPlan?.styleMimickingEnabled ? ' CheckboxLabel--disabled' : ''}`}
                >
                  <input
                    id="style-mimicking"
                    type="checkbox"
                    checked={config.enableStyleMimicking}
                    onChange={(e) => {
                      if (currentPlan?.styleMimickingEnabled) {
                        setConfig({ ...config, enableStyleMimicking: e.target.checked });
                      }
                    }}
                    disabled={!currentPlan?.styleMimickingEnabled}
                    className="CheckboxInput"
                  />
                  <span className={!currentPlan?.styleMimickingEnabled ? 'LabelMuted' : ''}>
                    Enable User Style Mimicking
                    {!currentPlan?.styleMimickingEnabled && (
                      <span className="PlanOnlyBadge">
                        (Pro/Ultimate only)
                      </span>
                    )}
                  </span>
                </label>
                <p className="HelpText HelpTextIndent">
                  When enabled, the extension analyzes your writing style from previous emails and matches it in generated drafts.
                  {!currentPlan?.styleMimickingEnabled && (
                    <span className="UpgradePrompt">
                      Upgrade to Pro or Ultimate plan to enable this feature.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Packages Tab */}
          {activeTab === 'packages' && (
            <div className="SettingsSection">
              <h2>Subscription Plan</h2>
              <p className="HelpText HelpTextSection">
                {licenseStatus.status === 'success' && licenseStatus.plan
                  ? `Your subscription plan is determined by your active license key. You are currently on the ${licenseStatus.plan.charAt(0).toUpperCase() + licenseStatus.plan.slice(1)} plan.`
                  : 'Activate a license key above to unlock paid plans. Without a license, you are limited to the Free plan.'}
              </p>

              {/* Plan Details Display */}
              {licenseStatus.status === 'success' && licenseStatus.plan && currentPlan ? (
                <div className="SettingGroup">
                  <div className="PlanDetailsCard">
                    <div className="PlanDetailsTitle">
                      {licenseStatus.plan && licenseStatus.plan.charAt(0).toUpperCase() + licenseStatus.plan.slice(1)} Plan Details
                    </div>
                    <p className="PlanDetailsSummary">
                      Max Goals: {currentPlan.maxGoals} | Max Variants: {currentPlan.maxVariants} | Max Tones: {currentPlan.maxTones} |
                      Generations: {currentPlan.maxGenerationsPerMonth === 999999999999 ? 'Unlimited' : currentPlan.maxGenerationsPerMonth}/month
                    </p>
                    {/* Enable Overage Billing - only when user has valid license and plan */}
                    <div className="SettingGroup OverageCheckboxGroup">
                      <label className="OverageCheckboxLabel">
                        <input
                          type="checkbox"
                          checked={overageEnabled}
                          onChange={(e) => updateOverageSetting(e.target.checked)}
                          disabled={overageLoading}
                          className="CheckboxInput"
                        />
                        <div className="OverageCheckboxContent">
                          <div className="OverageCheckboxTitle">Enable Overage Billing</div>
                          <p className="HelpText HelpTextNoMargin">
                            {overageEnabled
                              ? 'When enabled, you can exceed your monthly quota. Extra generations will be charged at your plan\'s overage rate at the end of the billing cycle.'
                              : 'When disabled, generation will be blocked once you reach your monthly quota. Enable to allow overages with automatic billing.'}
                          </p>
                        </div>
                      </label>
                      {overageLoading && (
                        <p className="HelpText HelpTextInline">Updating...</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="SaveButton ViewPlansButton"
                      onClick={() => {
                        window.open('https://xrepl.ai/pricing', '_blank');
                      }}
                    >
                      View Plans
                    </button>
                  </div>
                  
                  {/* Usage Display */}
                  <UsageDisplay licenseKey={licenseKey} showUpgradeRecommendation={true} compact={false} />
                </div>
              ) : (
                <div className="SettingGroup">
                  <p className="HelpText HelpTextWarning">
                    ⚠️ License key required for paid plans. Currently using Free plan limits.
                  </p>
                </div>
              )}

              {/* Your Packages Section - Only show when user owns packages */}
              {licenseStatus.status === 'success' && (
                <>
                  {packagesLoading ? (
                    <>
                      <h2 className="SectionHeading">Your Packages</h2>
                      <p className="HelpText HelpTextSection">Loading packages...</p>
                    </>
                  ) : packagesData && (
                    (packagesData.included && packagesData.included.length > 0) ||
                    (packagesData.purchased && packagesData.purchased.length > 0)
                  ) ? (
                    <>
                      <h2 className="SectionHeading">Your Packages</h2>
                      {/* Included Packages */}
                      {packagesData.included && packagesData.included.length > 0 && (
                        <div className="PackageSubsection">
                          <h3 className="PackageSubsectionTitle">Included Packages</h3>
                          <div className="PackageList">
                            {packagesData.included.map((pkg) => (
                              <div key={pkg.id} className="PackageCard">
                                <div className="PackageCardTitle">
                                  {pkg.title ?? (pkg.name ? pkg.name.charAt(0).toUpperCase() + pkg.name.slice(1) : '—')}
                                  {pkg.status === 'active' && (
                                    <span className="PackageStatusBadge PackageStatusBadge--active">✓ Active</span>
                                  )}
                                </div>
                                {(pkg.details ?? '').trim() && (
                                  <div className="PackageDetails">{pkg.details}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Purchased Packages */}
                      {packagesData.purchased && packagesData.purchased.length > 0 && (
                        <div className="PackageSubsection">
                          <h3 className="PackageSubsectionTitle">Purchased Packages</h3>
                          <div className="PackageList">
                            {packagesData.purchased.map((pkg) => (
                              <div
                                key={pkg.id}
                                className={`PackageCard${pkg.status !== 'active' ? ' PackageCard--inactive' : ''}`}
                              >
                                <div className="PackageCardTitle">
                                  {pkg.title ?? (pkg.name ? pkg.name.charAt(0).toUpperCase() + pkg.name.slice(1) : '—')}
                                  <span className={`PackageStatusBadge ${pkg.status === 'active' ? 'PackageStatusBadge--active' : 'PackageStatusBadge--inactive'}`}>
                                    {pkg.status === 'active' ? '✓ Active' : `⚠ ${pkg.status}`}
                                  </span>
                                </div>
                                {(pkg.details ?? '').trim() && (
                                  <div className="PackageDetails">{pkg.details}</div>
                                )}
                                {pkg.payment_status && (
                                  <div className="PackagePayment">Payment: {pkg.payment_status}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : packagesData ? (
                    // User has no owned packages - don't show "Your Packages" section
                    null
                  ) : (
                    <>
                      <h2 className="SectionHeading">Your Packages</h2>
                      <p className="HelpText HelpTextSection">
                        Unable to load packages. Please check your license key.
                      </p>
                    </>
                  )}
                </>
              )}

              {/* Available Packages Section - Only show when packages are available for purchase */}
              {licenseStatus.status === 'success' && !packagesLoading && packagesData && packagesData.available && packagesData.available.length > 0 && (
                <div className="AvailableSection" data-section="available-packages">
                  <h2>Available Packages</h2>
                  <p className="HelpText HelpTextAvailable">
                    Purchase additional packages to unlock more email types.
                  </p>
                  <div className="PackageList">
                    {packagesData.available.map((pkg) => (
                      <div key={pkg.id} className="AvailablePackageCard">
                        <div className="AvailablePackageCardContent">
                          <div className="AvailablePackageCardTitle">
                            {pkg.title ?? (pkg.name ? pkg.name.charAt(0).toUpperCase() + pkg.name.slice(1) : '—')}
                          </div>
                          {(pkg.details ?? '').trim() && (
                            <div className="PackageDetails">{pkg.details}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="SaveButton SaveButton--shrink"
                          onClick={() => handlePackagePurchase(pkg.id, pkg.name)}
                        >
                          ${pkg.price_usd.toFixed(2)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Default Role Tab */}
          {activeTab === 'defaultRole' && showDefaultRoleTab && (
            <div className="SettingsSection">
              <h2>Default Role</h2>
              <p className="HelpText HelpTextSection">
                Select the default role to use when generating drafts for new emails. This will be pre-selected in the dropdown.
              </p>

              <div className="SettingGroup">
                <label htmlFor="default-role">Default Role:</label>
                <select
                  id="default-role"
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  className="SelectDefault"
                >
                  {selectedPackages.map((pkgName) => {
                    const displayName = packageTitleByName[pkgName] ?? (pkgName === 'generic' ? 'General' : pkgName.charAt(0).toUpperCase() + pkgName.slice(1));
                    return (
                      <option key={pkgName} value={pkgName}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
                <p className="HelpText HelpTextInline">
                  This role will be automatically selected when generating drafts for new emails
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="SaveAllRow">
          <button type="button" className="SaveButton" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save All Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Options;
