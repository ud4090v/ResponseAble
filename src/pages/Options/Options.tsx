import React, { useState, useEffect } from 'react';
import './Options.css';

interface Props {
  title: string;
}

interface ApiConfig {
  provider: 'openai' | 'grok';
  model: string;
  numVariants: number;
}

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
  const [config, setConfig] = useState<ApiConfig>({
    provider: 'grok',
    model: 'grok-4-latest',
    numVariants: 4,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(['apiProvider', 'apiModel', 'numVariants'], (result) => {
      setConfig({
        provider: (result.apiProvider as ApiConfig['provider']) || 'grok',
        model: result.apiModel || 'grok-4-latest',
        numVariants: result.numVariants || 4,
      });
    });
  }, []);

  const handleProviderChange = (provider: ApiConfig['provider']) => {
    const providerConfig = API_PROVIDERS[provider];
    setConfig({
      ...config,
      provider,
      model: providerConfig.models[0], // Set to first model of new provider
    });
  };

  const handleSave = () => {
    // Validate numVariants (must be between 1 and 7)
    const validatedNumVariants = Math.max(1, Math.min(7, config.numVariants));

    chrome.storage.sync.set(
      {
        apiProvider: config.provider,
        apiModel: config.model,
        numVariants: validatedNumVariants,
      },
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    );
  };

  const currentProviderConfig = API_PROVIDERS[config.provider];

  return (
    <div className="OptionsContainer">
      <div className="OptionsContent">
        <h1>{title}</h1>
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

          <button className="SaveButton" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Options;
