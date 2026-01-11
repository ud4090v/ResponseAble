import React, { useState, useEffect } from 'react';
import './Options.css';
import ALL_PACKAGES_DATA from '../../config/packages.json';

interface Props {
  title: string;
}

interface ApiConfig {
  provider: 'openai' | 'grok';
  model: string;
  numVariants: number;
  classificationConfidenceThreshold: number;
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

// Master list of all available packages - imported from shared config
const ALL_PACKAGES: Package[] = ALL_PACKAGES_DATA as Package[];

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
    classificationConfidenceThreshold: 0.85,
  });
  const [selectedPackages, setSelectedPackages] = useState<string[]>(['generic']);
  const [defaultRole, setDefaultRole] = useState<string>('generic');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(['apiProvider', 'apiModel', 'numVariants', 'classificationConfidenceThreshold', 'selectedPackages', 'defaultRole'], (result) => {
      setConfig({
        provider: (result.apiProvider as ApiConfig['provider']) || 'grok',
        model: result.apiModel || 'grok-4-latest',
        numVariants: result.numVariants || 4,
        classificationConfidenceThreshold: result.classificationConfidenceThreshold !== undefined ? result.classificationConfidenceThreshold : 0.85,
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

  const handleProviderChange = (provider: ApiConfig['provider']) => {
    const providerConfig = API_PROVIDERS[provider];
    setConfig({
      ...config,
      provider,
      model: providerConfig.models[0], // Set to first model of new provider
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
    // Validate numVariants (must be between 1 and 7)
    const validatedNumVariants = Math.max(1, Math.min(7, config.numVariants));

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
        classificationConfidenceThreshold: validatedConfidenceThreshold,
        selectedPackages: packagesToSave,
        defaultRole: validatedDefaultRole,
      },
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    );
  };

  const currentProviderConfig = API_PROVIDERS[config.provider];
  const showDefaultRoleTab = selectedPackages.length > 1 || (selectedPackages.length === 1 && !selectedPackages.includes('generic'));

  return (
    <div className="OptionsContainer">
      <div className="OptionsContent">
        <h1>{title}</h1>

        {/* Tabs */}
        <div className="TabsContainer">
          <button
            className={`Tab ${activeTab === 'models' ? 'TabActive' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            Models
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
                  {Object.entries(API_PROVIDERS).map(([key, value]) => (
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
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                >
                  {currentProviderConfig.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="SettingGroup">
                <label htmlFor="num-variants">Number of Variants:</label>
                <input
                  id="num-variants"
                  type="number"
                  min="1"
                  max="7"
                  value={config.numVariants}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 7) {
                      setConfig({ ...config, numVariants: value });
                    }
                  }}
                  style={{ padding: '8px', fontSize: '14px', width: '100px' }}
                />
                <p className="HelpText" style={{ marginTop: '4px', fontSize: '12px', color: '#5f6368' }}>
                  Number of response variants to generate (1-7, default: 4)
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
            </div>
          )}

          {/* Packages Tab */}
          {activeTab === 'packages' && (
            <div className="SettingsSection">
              <h2>Email Type Packages</h2>
              <p className="HelpText" style={{ marginBottom: '20px', fontStyle: 'normal' }}>
                Select which email type packages to use for classification. Multiple selections are allowed.
                If no packages are selected, "generic" will be used by default.
              </p>

              <div className="SettingGroup">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {ALL_PACKAGES.map((pkg) => (
                    <label
                      key={pkg.name}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        backgroundColor: selectedPackages.includes(pkg.name) ? '#f0f7ff' : '#fff',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPackages.includes(pkg.name)}
                        onChange={() => handlePackageToggle(pkg.name)}
                        style={{ marginRight: '12px', marginTop: '2px', cursor: 'pointer' }}
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
