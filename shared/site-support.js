// Site Support Detection Module
const SiteSupport = {
    isSupported: false,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.check();

        // Continuous checks
        if (chrome.tabs) {
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.status === 'complete' || changeInfo.url) {
                    this.check();
                }
            });

            chrome.tabs.onActivated.addListener(() => {
                this.check();
            });
        }
    },

    check() {
        if (!chrome.tabs) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) return;

            const url = tab.url || '';
            // Supported: http, https, file. Unsupported: chrome://, edge://, about:, etc.
            this.isSupported = url.startsWith('http') || url.startsWith('file');

            this.updateUI();
        });
    },

    updateUI() {
        // UI updates are specific to the sidepanel usually, but we check if elements exist
        const inspectBtn = document.getElementById('inspectBtn');
        const statusIndicator = document.getElementById('siteSupportStatus');

        if (statusIndicator) {
            statusIndicator.className = this.isSupported ? 'status-dot supported' : 'status-dot unsupported';
            statusIndicator.title = this.isSupported ? 'Site Supported' : 'Site Not Supported';
        }

        if (inspectBtn) {
            if (this.isSupported) {
                inspectBtn.classList.remove('disabled');
                inspectBtn.title = 'Inspect Elements';
            } else {
                inspectBtn.classList.add('disabled');
                inspectBtn.title = 'Site not supported';

                // Ensure inspect is deactivated if site becomes unsupported
                if (window.LocatorX && LocatorX.inspect && LocatorX.inspect.isActive) {
                    LocatorX.inspect.deactivate();
                }
            }
        }

        // Also update inspect button visual state if it was active/inactive
        if (window.LocatorX && LocatorX.inspect) {
            LocatorX.inspect.updateUI();
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteSupport;
} else {
    window.SiteSupport = SiteSupport;
}
