import React, { useEffect, useState } from 'react';
import './Popup.css';
import UsageDisplay from '../../components/UsageDisplay';
import { VERCEL_PROXY_URL } from '../../config/apiKeys.js';

// Cross-browser API compatibility
const getBrowser = () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  return null;
};

// Plans that include content packages (add-ons)
const PLANS_WITH_PACKAGES = ['pro', 'ultimate', 'pro_plus', 'basic'];

// Plans that include priority support (for plan details bullet list)
const PLANS_WITH_PRIORITY_SUPPORT = ['pro', 'pro_plus', 'ultimate'];

// Threshold for displaying "Unlimited" instead of a number
const UNLIMITED_GENERATIONS = 999999999999;

const Popup = () => {
  const [apiProvider, setApiProvider] = useState('');
  const [apiModel, setApiModel] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [activeTab, setActiveTab] = useState('settings');
  const [usageData, setUsageData] = useState(null);
  const [defaultRole, setDefaultRole] = useState('generic');
  const [packagesData, setPackagesData] = useState(null);

  useEffect(() => {
    const browserAPI = getBrowser();
    if (!browserAPI) return;

    if (browserAPI.storage) {
      browserAPI.storage.sync.get(['apiProvider', 'apiModel', 'licenseKey', 'defaultRole'], (result) => {
        setApiProvider(result.apiProvider || 'grok');
        setApiModel(result.apiModel || 'grok-4-latest');
        setLicenseKey(result.licenseKey || '');
        setDefaultRole(result.defaultRole && typeof result.defaultRole === 'string' ? result.defaultRole : 'generic');
      });
    }

    if (browserAPI.runtime) {
      try {
        const url = browserAPI.runtime.getURL('xReplAI-brandw.png');
        setIconUrl(url);
      } catch (error) {
        console.error('Failed to get icon URL:', error);
      }
    }

    if (browserAPI.storage) {
      browserAPI.storage.local.get(['metrics'], (result) => {
        const metrics = result.metrics || {
          draftsGenerated: 0,
          draftsInserted: 0,
          thumbsUp: 0,
          thumbsDown: 0,
          roleUsage: {},
          draftsThisWeek: 0,
          draftsThisMonth: 0
        };

        const insertRate = metrics.draftsGenerated > 0
          ? Math.round((metrics.draftsInserted / metrics.draftsGenerated) * 100)
          : 0;

        const totalSeconds = metrics.draftsInserted * 30;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        let timeSavedText = '';
        if (hours > 0) {
          timeSavedText = `~${hours} hour${hours > 1 ? 's' : ''}`;
          if (minutes > 0) {
            timeSavedText += ` ${minutes} minute${minutes > 1 ? 's' : ''}`;
          }
        } else {
          timeSavedText = `~${minutes} minute${minutes > 1 ? 's' : ''}`;
        }

        let mostUsedRole = null;
        let mostUsedRoleCount = 0;
        let totalRoleUsage = 0;
        for (const [role, count] of Object.entries(metrics.roleUsage || {})) {
          totalRoleUsage += count;
          if (count > mostUsedRoleCount) {
            mostUsedRoleCount = count;
            mostUsedRole = role;
          }
        }
        const mostUsedRolePercentage = totalRoleUsage > 0
          ? Math.round((mostUsedRoleCount / totalRoleUsage) * 100)
          : 0;

        const totalFeedback = (metrics.thumbsUp || 0) + (metrics.thumbsDown || 0);
        const feedbackScore = totalFeedback > 0
          ? Math.round(((metrics.thumbsUp || 0) / totalFeedback) * 100)
          : 0;

        setMetrics({
          draftsGenerated: metrics.draftsGenerated || 0,
          draftsInserted: metrics.draftsInserted || 0,
          insertRate: insertRate,
          timeSaved: timeSavedText,
          draftsThisWeek: metrics.draftsThisWeek || 0,
          draftsThisMonth: metrics.draftsThisMonth || 0,
          mostUsedRole: mostUsedRole,
          mostUsedRolePercentage: mostUsedRolePercentage,
          feedbackScore: feedbackScore,
          totalFeedback: totalFeedback
        });
      });
    }
  }, []);

  // Fetch usage for Settings tab (plan, packages, usage summary)
  useEffect(() => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      setUsageData(null);
      return;
    }
    const fetchUsage = async () => {
      try {
        const response = await fetch(`${VERCEL_PROXY_URL}/usage-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey }),
        });
        if (!response.ok) return;
        const data = await response.json();
        setUsageData(data.valid ? data : null);
      } catch (err) {
        setUsageData(null);
      }
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [licenseKey]);

  // Fetch packages list for Settings tab (included packages + default role)
  useEffect(() => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      setPackagesData(null);
      return;
    }
    const fetchPackages = async () => {
      try {
        const response = await fetch(`${VERCEL_PROXY_URL}/packages/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: licenseKey.trim() }),
        });
        if (!response.ok) return;
        const data = await response.json();
        setPackagesData(data.valid ? data : null);
      } catch (err) {
        setPackagesData(null);
      }
    };
    fetchPackages();
  }, [licenseKey]);

  const openOptions = () => {
    const browserAPI = getBrowser();
    if (browserAPI && browserAPI.runtime) {
      browserAPI.runtime.openOptionsPage();
      window.close();
    }
  };

  const openAccount = () => {
    const url = licenseKey && licenseKey.trim()
      ? `https://xrepl.ai/account?license=${encodeURIComponent(licenseKey.trim())}`
      : 'https://xrepl.ai/account';
    window.open(url, '_blank');
  };

  const planDisplayName = (plan) => {
    if (!plan) return '—';
    if (plan === 'pro_plus') return 'Pro+';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const hasPackages = usageData?.plan && PLANS_WITH_PACKAGES.includes(usageData.plan);

  const hasLicense = licenseKey && licenseKey.trim().length > 0;

  const openPricing = () => {
    window.open('https://xrepl.ai/pricing', '_blank');
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        {iconUrl && (
          <img src={iconUrl} alt="xReplAI" className="popup-brand" />
        )}
        <p className="popup-subtitle">Smarter Replies, Instantly</p>
      </div>

      <div className="popup-content">
        {!hasLicense ? (
          <>
            <div className="popup-info">
              <p>Enter your license key in Settings to use xReplAI, or get access below.</p>
            </div>
            <div className="popup-buttons" style={{ flexDirection: 'column', marginTop: '12px' }}>
              <button type="button" className="popup-button" onClick={openPricing} style={{ width: '100%' }}>
                Get Access
              </button>
              <button type="button" className="popup-button popup-button-secondary" onClick={openOptions}>
                Open Settings
              </button>
            </div>
          </>
        ) : (
          <>
        <div className="popup-info">
          <p>Use the <strong>xReplAI</strong> button in Gmail or LinkedIn to create AI-powered email drafts.</p>
        </div>

        <div className="popup-tabs">
          <button
            type="button"
            className={`popup-tab ${activeTab === 'settings' ? 'popup-tab-active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button
            type="button"
            className={`popup-tab ${activeTab === 'statistics' ? 'popup-tab-active' : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            Statistics
          </button>
        </div>

        {activeTab === 'settings' && (
          <div className="popup-tab-panel">
            <div className="popup-settings-section">
              <div className="popup-setting-row">
                <strong>Plan:</strong>{' '}
                <span className="setting-value">
                  {usageData ? planDisplayName(usageData.plan) : 'Loading…'}
                </span>
              </div>
              {usageData && usageData.plan && usageData.generations && (
                <ul className="popup-plan-details-list">
                  <li>
                    {usageData.generations.included >= UNLIMITED_GENERATIONS
                      ? 'Unlimited generations per month'
                      : `${(usageData.generations.included || 0).toLocaleString()} generations per month`}
                  </li>
                  <li>
                    {hasPackages && packagesData?.packages
                      ? (() => {
                          const included = (packagesData.packages.included || []).length;
                          const purchased = (packagesData.packages.purchased || []).length;
                          if (included === 0 && purchased === 0) return 'Generic only';
                          const parts = [];
                          if (included > 0) parts.push(`${included} content package${included === 1 ? '' : 's'} included`);
                          if (purchased > 0) parts.push(`${purchased} purchased`);
                          return parts.join(', ');
                        })()
                      : 'Generic only'}
                  </li>
                  <li>
                    {usageData.overage?.enabled && typeof usageData.overage.rate === 'number'
                      ? `Overage available at $${usageData.overage.rate.toFixed(2)}/generation`
                      : 'Overage not available'}
                  </li>
                  {PLANS_WITH_PRIORITY_SUPPORT.includes(usageData.plan) && (
                    <li>Priority support</li>
                  )}
                </ul>
              )}
              <div className="popup-setting-row popup-packages-row">
                <strong>Packages:</strong>
              </div>
              {usageData && (hasPackages ? (
                <ul className="popup-packages-list">
                  {packagesData && packagesData.packages ? (
                    (() => {
                      const included = packagesData.packages.included || [];
                      const purchased = packagesData.packages.purchased || [];
                      const combined = [...included, ...purchased];
                      const hasGeneric = combined.some((p) => p.name === 'generic');
                      let list = combined;
                      if (defaultRole === 'generic' && !hasGeneric) {
                        list = [{ name: 'generic', title: 'General' }, ...list];
                      }
                      if (list.length === 0) {
                        return (
                          <li>
                            <span className="setting-value">Generic</span>
                            {defaultRole === 'generic' && <span className="popup-default-badge">Default</span>}
                          </li>
                        );
                      }
                      return list.map((pkg) => (
                        <li key={pkg.id || pkg.name}>
                          <span className="setting-value">{pkg.title || (pkg.name ? pkg.name.charAt(0).toUpperCase() + pkg.name.slice(1) : '—')}</span>
                          {pkg.name === defaultRole && <span className="popup-default-badge">Default</span>}
                        </li>
                      ));
                    })()
                  ) : (
                    <li className="popup-packages-loading">Loading…</li>
                  )}
                </ul>
              ) : usageData && usageData.plan === 'free' ? (
                <ul className="popup-packages-list">
                  <li>
                    <span className="setting-value">General</span>
                    {defaultRole === 'generic' && <span className="popup-default-badge">Default</span>}
                  </li>
                </ul>
              ) : (
                <p className="popup-packages-none">—</p>
              ))}
            </div>

            <UsageDisplay licenseKey={licenseKey} showUpgradeRecommendation={true} compact={true} />

            {usageData && usageData.overage && usageData.generations && usageData.generations.used >= usageData.generations.included && usageData.overage.used > 0 && (
              <div className="popup-overage-due">
                <p><strong>Bonus generations used:</strong> {usageData.overage.used.toLocaleString()}</p>
                <p><strong>Current amount due:</strong> ${(usageData.overage.cost || 0).toFixed(2)} <span className="popup-overage-note">(at ${(usageData.overage.rate || 0).toFixed(2)}/gen)</span></p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'statistics' && metrics && (
          <div className="popup-tab-panel popup-metrics">
            <div className="popup-metrics-inner">
              <p className="popup-metric"><strong>Total Drafts Generated:</strong> {metrics.draftsGenerated.toLocaleString()}</p>
              <p className="popup-metric"><strong>Drafts Inserted:</strong> {metrics.draftsInserted.toLocaleString()}</p>
              <p className="popup-metric"><strong>Insert Rate:</strong> {metrics.insertRate}%</p>
              <p className="popup-metric"><strong>Time Saved:</strong> {metrics.timeSaved}</p>
              <p className="popup-metric"><strong>This Week:</strong> {metrics.draftsThisWeek} drafts</p>
              {metrics.mostUsedRole && (
                <p className="popup-metric">
                  <strong>Top Role:</strong> {metrics.mostUsedRole.charAt(0).toUpperCase() + metrics.mostUsedRole.slice(1)} ({metrics.mostUsedRolePercentage}%)
                </p>
              )}
              {metrics.totalFeedback > 0 && (
                <p className="popup-metric"><strong>Feedback Score:</strong> {metrics.feedbackScore}% helpful</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'statistics' && !metrics && (
          <div className="popup-tab-panel">
            <p className="popup-muted">No statistics yet. Generate some drafts to see your KPIs here.</p>
          </div>
        )}

        <div className="popup-buttons">
          <button type="button" className="popup-button popup-button-secondary" onClick={openAccount}>
            My Account
          </button>
          <button type="button" className="popup-button" onClick={openOptions}>
            Open Settings
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Popup;
