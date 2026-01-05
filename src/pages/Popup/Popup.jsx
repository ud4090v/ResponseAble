import React, { useEffect, useState } from 'react';
import './Popup.css';

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

  useEffect(() => {
    const browserAPI = getBrowser();
    if (!browserAPI) return;

    // Load current settings
    if (browserAPI.storage) {
      browserAPI.storage.sync.get(['apiProvider', 'apiModel'], (result) => {
        setApiProvider(result.apiProvider || 'grok');
        setApiModel(result.apiModel || 'grok-4-latest');
      });
    }

    // Get icon URL
    if (browserAPI.runtime) {
      try {
        const url = browserAPI.runtime.getURL('raicon.png');
        setIconUrl(url);
      } catch (error) {
        console.error('Failed to get icon URL:', error);
      }
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
          ResponseAble
        </h1>
        <p className="popup-subtitle">AI-Powered Email Responses</p>
      </div>

      <div className="popup-content">
        <div className="popup-info">
          <p>Use the <strong>Generate</strong> or <strong>Respond</strong> button in Gmail to create AI-powered email drafts.</p>
        </div>

        {apiProvider && apiModel && (
          <div className="popup-settings">
            <p><strong>Current Settings:</strong></p>
            <p>Provider: <span className="setting-value">{apiProvider.toUpperCase()}</span></p>
            <p>Model: <span className="setting-value">{apiModel}</span></p>
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
