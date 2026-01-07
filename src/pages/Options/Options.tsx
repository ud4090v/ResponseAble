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

interface Package {
  name: string;
  description: string;
  intent: string;
  roleDescription: string;
  contextSpecific: string;
}

// Master list of all available packages
const ALL_PACKAGES: Package[] = [
  {
    name: "sales",
    description: "emails about deals, follow-ups, objections, meetings, and closing business",
    intent: "The sender is selling a product or service to the recipient. Consider their approach: cold outreach (initial contact), follow-up (nudge after no response), offering discount (price incentive), value proposition (highlight benefits), or closing (meeting/demo request).",
    roleDescription: "a world-class B2B sales email writer",
    contextSpecific: "Respond as a potential customer evaluating the offer. Consider: pricing, value proposition, fit with your needs, and next steps. Use variants that match your interest level and decision-making stage."
  },
  {
    name: "recruitment",
    description: "emails about hiring, candidates, sourcing talent, interviews, and job offers",
    intent: "The sender is a recruiter offering a job position or opportunity to the recipient. Consider what they're offering: specific role details, interview invitation, salary range, company culture fit, or next steps in hiring process.",
    roleDescription: "a professional candidate responding to a recruiter's job offer",
    contextSpecific: "The sender (recruiter) is OFFERING a job position to YOU (the recipient/candidate). Respond as the candidate - express interest, ask questions about the role/company/compensation, or politely decline. Consider: role fit, career goals, compensation, company culture, and work-life balance. Do NOT respond as if you are offering them a job."
  },
  {
    name: "jobseeker",
    description: "emails about job applications, interviews, follow-ups as a candidate, and career opportunities",
    intent: "The sender is a job seeker applying to or following up with the recipient. Consider their intent: expressing interest in a role, attaching resume, requesting interview, thanking after meeting, or seeking referrals.",
    roleDescription: "a hiring manager or recruiter responding to a job application",
    contextSpecific: "The sender is applying for a position. Respond as the recipient (hiring manager/recruiter). Consider: candidate qualifications, fit with role requirements, next steps in hiring process, and providing constructive feedback if declining."
  },
  {
    name: "support",
    description: "emails about customer issues, complaints, troubleshooting, and resolutions",
    intent: "The sender is seeking help or reporting an issue to the recipient. Consider the problem: technical bug, billing inquiry, feature request, or service complaint, and urgency level.",
    roleDescription: "an empathetic customer support specialist",
    contextSpecific: "Address the customer's concern professionally and helpfully. Consider: urgency, impact, resolution options, escalation needs, and customer satisfaction. Provide clear next steps and timelines."
  },
  {
    name: "networking",
    description: "emails about professional connections, introductions, referrals, and collaborations",
    intent: "The sender is building or maintaining a professional relationship with the recipient. Consider the goal: warm introduction, referral request, collaboration proposal, or staying in touch after event.",
    roleDescription: "a professional building genuine connections",
    contextSpecific: "Build a meaningful professional relationship. Consider: mutual value, relationship building, reciprocity, and long-term connection. Keep it professional, warm, and relationship-focused."
  },
  {
    name: "generic",
    description: "general professional emails not fitting specific categories",
    intent: "The sender has a neutral professional intent toward the recipient. Consider basic goals like information sharing, scheduling, or simple acknowledgments without strong sales/hiring/support elements.",
    roleDescription: "a professional email reply writer",
    contextSpecific: "Carefully analyze the source email to understand the context, relationship, and intent. Respond appropriately from the recipient's perspective, considering the specific situation and relationship dynamics."
  }
];

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
  const [selectedPackages, setSelectedPackages] = useState<string[]>(['generic']);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(['apiProvider', 'apiModel', 'numVariants', 'selectedPackages'], (result) => {
      setConfig({
        provider: (result.apiProvider as ApiConfig['provider']) || 'grok',
        model: result.apiModel || 'grok-4-latest',
        numVariants: result.numVariants || 4,
      });
      // Load selected packages, default to ['generic'] if none selected
      if (result.selectedPackages && Array.isArray(result.selectedPackages) && result.selectedPackages.length > 0) {
        setSelectedPackages(result.selectedPackages);
      } else {
        setSelectedPackages(['generic']);
      }
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

  const handlePackageToggle = (packageName: string) => {
    setSelectedPackages((prev) => {
      if (prev.includes(packageName)) {
        // If unchecking the last package, ensure at least 'generic' is selected
        const newSelection = prev.filter((p) => p !== packageName);
        return newSelection.length > 0 ? newSelection : ['generic'];
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

    chrome.storage.sync.set(
      {
        apiProvider: config.provider,
        apiModel: config.model,
        numVariants: validatedNumVariants,
        selectedPackages: packagesToSave,
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

        <div className="SettingsSection" style={{ marginTop: '40px' }}>
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

          <button className="SaveButton" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Options;
