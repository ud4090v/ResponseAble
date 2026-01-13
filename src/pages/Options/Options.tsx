import React, { useState, useEffect } from 'react';
import './Options.css';
import ALL_PACKAGES_DATA from '../../config/packages.json';
import SUBSCRIPTION_PLANS_DATA from '../../config/subscriptionPlans.json';

interface Props {
  title: string;
}

interface ApiConfig {
  provider: 'openai' | 'grok';
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
  contentPackagesAllowed: boolean;
  allContent: boolean;
  styleMimickingEnabled: boolean;
}

// Master list of all available packages - imported from shared config
const ALL_PACKAGES: Package[] = ALL_PACKAGES_DATA as Package[];
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = SUBSCRIPTION_PLANS_DATA as SubscriptionPlan[];

const API_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  grok: {
    name: 'Grok (xAI)',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    models: ['grok-2-vision-1212', 'grok-2-1212', 'grok-beta', 'grok-4-latest', 'grok-4-fast'],
  },
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
  const [saved, setSaved] = useState(false);
  const [iconUrl, setIconUrl] = useState<string>('');

  useEffect(() => {
    // Get icon URL
    try {
      const url = chrome.runtime.getURL('xrepl-light.png');
      setIconUrl(url);
    } catch (error) {
      console.error('Failed to get icon URL:', error);
    }

    // Load saved settings
    chrome.storage.sync.get(['apiProvider', 'apiModel', 'numVariants', 'numGoals', 'numTones', 'classificationConfidenceThreshold', 'enableStyleMimicking', 'selectedPackages', 'defaultRole', 'subscriptionPlan'], (result) => {
      // Load subscription plan, default to 'free' if not set
      const loadedPlan = result.subscriptionPlan && typeof result.subscriptionPlan === 'string' ? result.subscriptionPlan : 'free';
      setSubscriptionPlan(loadedPlan);

      setConfig({
        provider: (result.apiProvider as ApiConfig['provider']) || 'grok',
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
    });
  }, []);

  // Auto-reset default role to generic if it's not in selected packages
  useEffect(() => {
    if (!selectedPackages.includes(defaultRole)) {
      setDefaultRole('generic');
    }
  }, [selectedPackages, defaultRole]);

  const getCurrentPlan = (): SubscriptionPlan | undefined => {
    return SUBSCRIPTION_PLANS.find(p => p.name === subscriptionPlan);
  };

  const handleSubscriptionPlanChange = (planName: string) => {
    const newPlan = SUBSCRIPTION_PLANS.find(p => p.name === planName);
    if (!newPlan) return;

    const oldPlan = getCurrentPlan();
    const oldTier = oldPlan?.tier || 0;
    const newTier = newPlan.tier;

    // Handle content packages based on new plan
    if (!newPlan.contentPackagesAllowed) {
      // Downgrade: Clear all packages except generic
      setSelectedPackages(['generic']);
      setDefaultRole('generic');
    } else {
      // Upgrade: Handle allContent flag
      if (newPlan.allContent) {
        // Ultimate plan: Auto-select all packages
        const allPackageNames = ALL_PACKAGES.map(p => p.name);
        setSelectedPackages(allPackageNames);
        // Keep current defaultRole if valid, otherwise use first package
        if (allPackageNames.includes(defaultRole)) {
          // Keep current
        } else {
          setDefaultRole(allPackageNames[0]);
        }
      } else {
        // Pro plan: Keep existing packages if valid, otherwise default to generic
        if (selectedPackages.length === 0 || (selectedPackages.length === 1 && selectedPackages[0] === 'generic')) {
          // Keep as is or ensure generic is selected
          if (selectedPackages.length === 0) {
            setSelectedPackages(['generic']);
          }
        }
        // Otherwise keep existing selected packages
      }
    }

    // Handle provider/model/numVariants validation - consolidate all updates
    let updatedConfig = { ...config };

    // Check provider
    if (!newPlan.availableProviders.includes(config.provider)) {
      // Provider not available in new plan, reset to first available
      const firstProvider = newPlan.availableProviders[0] as ApiConfig['provider'];
      const firstModel = newPlan.availableModels[firstProvider]?.[0] || 'gpt-4o-mini';
      updatedConfig.provider = firstProvider;
      updatedConfig.model = firstModel;
    } else {
      // Provider is available, check if model is valid
      const availableModels = newPlan.availableModels[config.provider] || [];
      if (!availableModels.includes(config.model)) {
        // Model not available, reset to first available model for provider
        const firstModel = availableModels[0] || 'gpt-4o-mini';
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

    // Apply all config updates at once
    if (updatedConfig.provider !== config.provider || updatedConfig.model !== config.model ||
      updatedConfig.numVariants !== config.numVariants || updatedConfig.numGoals !== config.numGoals ||
      updatedConfig.numTones !== config.numTones) {
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
    const availableModels = currentPlan?.availableModels[provider] || API_PROVIDERS[provider].models;
    const firstModel = availableModels[0] || API_PROVIDERS[provider].models[0];

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
      },
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    );
  };

  const currentPlan = getCurrentPlan();
  const availableProvidersForPlan = currentPlan?.availableProviders || ['openai', 'grok'];
  const availableModelsForProvider = currentPlan?.availableModels[config.provider] || API_PROVIDERS[config.provider].models;

  // Filter providers and models based on subscription plan
  const filteredProviders = Object.entries(API_PROVIDERS).filter(([key]) =>
    availableProvidersForPlan.includes(key)
  );
  const currentProviderConfig = {
    ...API_PROVIDERS[config.provider],
    models: availableModelsForProvider.filter(model =>
      availableModelsForProvider.includes(model)
    ),
  };

  const showDefaultRoleTab = selectedPackages.length > 1 || (selectedPackages.length === 1 && !selectedPackages.includes('generic'));

  return (
    <div className="OptionsContainer">
      <div className="OptionsContent">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          {iconUrl && (
            <img 
              src={iconUrl} 
              alt="xRepl.ai" 
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
          )}
          <span>
            <span style={{ color: '#5567b9', fontWeight: '600' }}>xRepl.ai</span>
            <span> - Settings</span>
          </span>
        </h1>

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
            Packages
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
              <p className="HelpText" style={{ marginBottom: '20px', fontStyle: 'normal' }}>
                Select your preferred AI provider and model. API keys are managed by the extension developer.
              </p>

              <div className="SettingGroup">
                <label htmlFor="api-provider">API Provider:</label>
                <select
                  id="api-provider"
                  value={config.provider}
                  onChange={(e) => handleProviderChange(e.target.value as ApiConfig['provider'])}
                >
                  {filteredProviders.map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.name}
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
                  {currentProviderConfig.models.map((model) => (
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
              <p className="HelpText" style={{ marginBottom: '20px', fontStyle: 'normal' }}>
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
                  style={{ padding: '8px', fontSize: '14px', width: '100px' }}
                />
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
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
                  style={{ padding: '8px', fontSize: '14px', width: '100px' }}
                />
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
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
                  style={{ padding: '8px', fontSize: '14px', width: '100px' }}
                />
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
                  Number of tone options to generate (1-{currentPlan?.maxTones || 5})
                  {currentPlan && ` - Your ${currentPlan.name.charAt(0).toUpperCase() + currentPlan.name.slice(1)} plan allows up to ${currentPlan.maxTones} tones`}
                </p>
              </div>

              <div className="SettingGroup">
                <label htmlFor="confidence-threshold">Minimum Classification Confidence:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    style={{ flex: 1, maxWidth: '300px' }}
                  />
                  <span style={{ minWidth: '60px', fontSize: '14px', fontWeight: 'bold' }}>
                    {(config.classificationConfidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
                  If classification confidence is below this threshold, the system will use Generic package. Higher values = stricter matching (0.0-1.0, default: 0.85)
                </p>
              </div>

              {/* Style Mimicking Toggle - Show for all plans, but disabled for Free/Basic */}
              <div className="SettingGroup">
                <label htmlFor="style-mimicking" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: currentPlan?.styleMimickingEnabled ? 'pointer' : 'not-allowed' }}>
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
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      cursor: currentPlan?.styleMimickingEnabled ? 'pointer' : 'not-allowed',
                      opacity: currentPlan?.styleMimickingEnabled ? 1 : 0.5
                    }}
                  />
                  <span style={{ opacity: currentPlan?.styleMimickingEnabled ? 1 : 0.6 }}>
                    Enable User Style Mimicking
                    {!currentPlan?.styleMimickingEnabled && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#ea4335', fontWeight: 'normal' }}>
                        (Pro/Ultimate only)
                      </span>
                    )}
                  </span>
                </label>
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368', marginLeft: '30px' }}>
                  When enabled, the extension analyzes your writing style from previous emails and matches it in generated drafts.
                  {!currentPlan?.styleMimickingEnabled && (
                    <span style={{ display: 'block', marginTop: '4px', color: '#ea4335', fontWeight: '500' }}>
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
              <p className="HelpText" style={{ marginBottom: '20px', fontStyle: 'normal' }}>
                Select your subscription plan. This determines available features and limits.
              </p>

              <div className="SettingGroup">
                <label htmlFor="subscription-plan">Subscription Plan:</label>
                <select
                  id="subscription-plan"
                  value={subscriptionPlan}
                  onChange={(e) => handleSubscriptionPlanChange(e.target.value)}
                  style={{ padding: '8px', fontSize: '14px', width: '200px' }}
                >
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <option key={plan.name} value={plan.name}>
                      {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                    </option>
                  ))}
                </select>
                {currentPlan && (
                  <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
                    Max Goals: {currentPlan.maxGoals} | Max Variants: {currentPlan.maxVariants} | Max Tones: {currentPlan.maxTones} |
                    Generations: {currentPlan.maxGenerationsPerMonth === 999999999999 ? 'Unlimited' : currentPlan.maxGenerationsPerMonth}/month
                  </p>
                )}
              </div>

              {/* Email Type Packages Section - Only show if contentPackagesAllowed */}
              {currentPlan?.contentPackagesAllowed && (
                <>
                  <h2 style={{ marginTop: '40px' }}>Email Type Packages</h2>
                  <p className="HelpText" style={{ marginBottom: '20px', fontStyle: 'normal' }}>
                    Select which email type packages to use for classification. Multiple selections are allowed.
                    If no packages are selected, "generic" will be used by default.
                    {currentPlan.allContent && ' (All packages are automatically selected for Ultimate plan)'}
                  </p>

                  <div className="SettingGroup">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {ALL_PACKAGES.map((pkg) => (
                        <label
                          key={pkg.name}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            cursor: currentPlan.allContent ? 'not-allowed' : 'pointer',
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            backgroundColor: selectedPackages.includes(pkg.name) ? '#f0f7ff' : '#fff',
                            opacity: currentPlan.allContent ? 0.7 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPackages.includes(pkg.name)}
                            onChange={() => handlePackageToggle(pkg.name)}
                            disabled={currentPlan.allContent}
                            style={{ marginRight: '12px', marginTop: '2px', cursor: currentPlan.allContent ? 'not-allowed' : 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', textTransform: 'capitalize' }}>
                              {pkg.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#5f6368', marginBottom: '4px' }}>
                              {pkg.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="HelpText" style={{ marginTop: '12px', fontSize: '12px', color: '#5f6368' }}>
                      Selected packages: {selectedPackages.length > 0 ? selectedPackages.join(', ') : 'generic (default)'}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Default Role Tab */}
          {activeTab === 'defaultRole' && showDefaultRoleTab && (
            <div className="SettingsSection">
              <h2>Default Role</h2>
              <p className="HelpText" style={{ marginBottom: '20px', fontStyle: 'normal' }}>
                Select the default role to use when generating drafts for new emails. This will be pre-selected in the dropdown.
              </p>

              <div className="SettingGroup">
                <label htmlFor="default-role">Default Role:</label>
                <select
                  id="default-role"
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  style={{ padding: '8px', fontSize: '14px', width: '200px' }}
                >
                  {selectedPackages.map((pkgName) => {
                    const pkg = ALL_PACKAGES.find((p) => p.name === pkgName);
                    const displayName = pkgName === 'generic' ? 'Generic' : pkgName.charAt(0).toUpperCase() + pkgName.slice(1);
                    return (
                      <option key={pkgName} value={pkgName}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
                  This role will be automatically selected when generating drafts for new emails
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <button className="SaveButton" onClick={handleSave} style={{ padding: '12px 32px', fontSize: '16px' }}>
            {saved ? '✓ Saved!' : 'Save All Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Options;
