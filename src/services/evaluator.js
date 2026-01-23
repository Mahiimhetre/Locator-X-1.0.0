/**
 * Evaluator Service
 * Centralized logic for locator evaluation, highlighting, and code unwrapping.
 */
class Evaluator {
    constructor() {
        this.patterns = [
            // Selenium: By.id("..."), By.xpath('...')
            { regex: /By\.(?:xpath|id|name|className|cssSelector|linkText|partialLinkText)\s*\(\s*(['"])(.*?)\1\s*\)/i, typeIndex: 0, locatorIndex: 2 },
            // Selenium/Appium: findElement(By.id("..."))
            { regex: /findElement\s*\(\s*By\.[a-z]+\s*\(\s*(['"])(.*?)\1\s*\)\s*\)/i, typeIndex: 0, locatorIndex: 2 },
            // Playwright/Cypress/WDIO: page.locator("..."), cy.get('...'), $('...')
            { regex: /(?:\.locator|get|xpath|contains|\$)\s*\(\s*(['"])(.*?)\1\s*\)/i, typeIndex: 0, locatorIndex: 2 },
            // Generic method-like: find("...")
            { regex: /[a-z0-9_]+\s*\(\s*(['"])(.*?)\1\s*\)/i, typeIndex: 0, locatorIndex: 2 }
        ];
    }

    async evaluate(source, options = {}) {
        const settings = {
            type: 'auto',
            badge: null,
            highlight: true,
            callback: null,
            mode: 'home',
            ...options
        };

        let locator = '';
        let type = settings.type;

        if (typeof source === 'string') {
            const el = document.getElementById(source);
            locator = el ? (el.value || el.textContent) : source;
        } else if (source instanceof HTMLElement) {
            locator = source.value || source.textContent;
        }

        locator = locator ? locator.trim() : '';

        // Smart Unwrapping: If it looks like code, extract the selector
        if (this._isPotentialCode(locator)) {
            const unwrapped = this._unwrapCode(locator);
            if (unwrapped) {
                locator = unwrapped.locator;
                if (type === 'auto') type = unwrapped.type;
            }
        }

        if (!locator) {
            this._updateBadge(settings.badge, 0);
            if (settings.callback) settings.callback(0);
            return 0;
        }

        if (type === 'auto') {
            type = null; // Let content script handle smart discovery
        }

        this._updateBadge(settings.badge, '...');

        // Check Smart Correction preference
        const enableSmartCorrect = await this._shouldEnableSmartCorrect();

        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab || !tab.id) return resolve(0);

                chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                    let totalCount = 0;
                    let pending = frames.length;
                    let finalized = false;
                    let primaryResponse = null;

                    frames.forEach(frame => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'evaluateSelector',
                            selector: locator,
                            type: type,
                            enableSmartCorrect: enableSmartCorrect
                        }, { frameId: frame.frameId }, (response) => {
                            if (!chrome.runtime.lastError && response) {
                                totalCount += response.count || 0;
                                if (response.count === 1 && !primaryResponse) {
                                    primaryResponse = response;
                                }
                            }

                            pending--;
                            if (pending <= 0 && !finalized) {
                                finalized = true;
                                this._updateBadge(settings.badge, totalCount);

                                if (settings.highlight && totalCount > 0) {
                                    this.highlight(locator, 'highlightMatches', settings.mode);
                                }

                                if (settings.callback) settings.callback(totalCount, primaryResponse || response);
                                resolve(totalCount);
                            }
                        });
                    });
                });
            });
        });
    }

    async highlight(selector, action = 'highlightMatches', mode = 'home') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.id) {
                chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                    frames.forEach(frame => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: action,
                            selector: selector,
                            mode: mode
                        }, { frameId: frame.frameId }).catch(() => { });
                    });
                });
            }
        });
    }

    async _shouldEnableSmartCorrect() {
        return new Promise((resolve) => {
            // Check if feature is available for user's plan
            const isPlanAllowed = (typeof planService !== 'undefined') ?
                planService.isEnabled('module.smartCorrect') : false;

            if (!isPlanAllowed) {
                resolve(false);
                return;
            }

            // Check user preference from storage
            chrome.storage.local.get(['smartCorrectEnabled'], (result) => {
                // Default to true if not set
                const enabled = result.smartCorrectEnabled !== undefined ? result.smartCorrectEnabled : true;
                resolve(enabled);
            });
        });
    }

    _isPotentialCode(text) {
        if (!text || text.length < 5) return false;
        const markers = ['(', ')', '.', 'By.', 'cy.', 'page.', 'driver.', 'findElement', 'await', '$'];
        return markers.some(m => text.includes(m));
    }

    _unwrapCode(code) {
        for (const p of this.patterns) {
            const match = code.match(p.regex);
            if (match) {
                let locator = match[p.locatorIndex];
                let type = 'auto';

                const matchText = match[0].toLowerCase();
                if (matchText.includes('xpath')) type = 'xpath';
                else if (matchText.includes('css') || matchText.includes('get(')) type = 'css';
                else if (matchText.includes('id(')) type = 'id';
                else if (matchText.includes('name(')) type = 'name';
                else if (matchText.includes('linktext(')) type = 'linkText';

                return { locator, type };
            }
        }
        return null;
    }

    _updateBadge(badge, count) {
        let el = typeof badge === 'string' ? document.getElementById(badge) : badge;
        if (el && el.dataset) {
            el.dataset.count = count;
            el.classList.remove('hidden');
        }
    }
}

// Global Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Evaluator;
} else {
    window.Evaluator = Evaluator;
}
