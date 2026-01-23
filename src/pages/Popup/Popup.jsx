import React, { useEffect, useState } from 'react';
import './Popup.css';
import UsageDisplay from '../../components/UsageDisplay';

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

const Popup = () => {
  const [apiProvider, setApiProvider] = useState('');
  const [apiModel, setApiModel] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    const browserAPI = getBrowser();
    if (!browserAPI) return;

    // Load current settings
    if (browserAPI.storage) {
      browserAPI.storage.sync.get(['apiProvider', 'apiModel', 'licenseKey'], (result) => {
        setApiProvider(result.apiProvider || 'grok');
        setApiModel(result.apiModel || 'grok-4-latest');
        setLicenseKey(result.licenseKey || '');
      });
    }

    // Get icon URL
    if (browserAPI.runtime) {
      try {
        const url = browserAPI.runtime.getURL('xrepl-light.png');
        setIconUrl(url);
      } catch (error) {
        console.error('Failed to get icon URL:', error);
      }
    }

    // Load metrics
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

        // Calculate formatted metrics
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

  const openOptions = () => {
    const browserAPI = getBrowser();
    if (browserAPI && browserAPI.runtime) {
      browserAPI.runtime.openOptionsPage();
      window.close();
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1 className="popup-title">
          {iconUrl && (
            <img src={iconUrl} alt="ResponseAble" className="popup-icon" />
          )}
          xRepl.ai
        </h1>
        <p className="popup-subtitle">Smarter Replies, Instantly</p>
      </div>

      <div className="popup-content">
        <div className="popup-info">
          <p>Use the <strong>xReplAI</strong> button in Gmail or LinkedIn to create AI-powered email drafts.</p>
        </div>

        {apiProvider && apiModel && (
          <div className="popup-settings">
            <p><strong>Current Settings:</strong></p>
            <p>Provider: <span className="setting-value">{apiProvider.toUpperCase()}</span></p>
            <p>Model: <span className="setting-value">{apiModel}</span></p>
          </div>
        )}

        {/* Usage Tracking Section */}
        {licenseKey && licenseKey.trim().length > 0 && (
          <UsageDisplay licenseKey={licenseKey} showUpgradeRecommendation={true} compact={false} />
        )}

        {metrics && (
          <div className="popup-metrics" style={{ marginTop: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, color: '#5f6368' }}>
                <strong style={{ color: '#202124' }}>Total Drafts Generated:</strong> {metrics.draftsGenerated.toLocaleString()}
              </p>
              <p style={{ margin: 0, color: '#5f6368' }}>
                <strong style={{ color: '#202124' }}>Drafts Inserted:</strong> {metrics.draftsInserted.toLocaleString()}
              </p>
              <p style={{ margin: 0, color: '#5f6368' }}>
                <strong style={{ color: '#202124' }}>Insert Rate:</strong> {metrics.insertRate}%
              </p>
              <p style={{ margin: 0, color: '#5f6368' }}>
                <strong style={{ color: '#202124' }}>Time Saved:</strong> {metrics.timeSaved}
              </p>
              <p style={{ margin: 0, color: '#5f6368' }}>
                <strong style={{ color: '#202124' }}>This Week:</strong> {metrics.draftsThisWeek} drafts
              </p>
              {metrics.mostUsedRole && (
                <p style={{ margin: 0, color: '#5f6368' }}>
                  <strong style={{ color: '#202124' }}>Top Role:</strong> {metrics.mostUsedRole.charAt(0).toUpperCase() + metrics.mostUsedRole.slice(1)} ({metrics.mostUsedRolePercentage}%)
                </p>
              )}
              {metrics.totalFeedback > 0 && (
                <p style={{ margin: 0, color: '#5f6368' }}>
                  <strong style={{ color: '#202124' }}>Feedback Score:</strong> {metrics.feedbackScore}% helpful
                </p>
              )}
            </div>
          </div>
        )}

        <button className="popup-button" onClick={openOptions}>
          Open Settings
        </button>
      </div>
    </div>
  );
};

export default Popup;
