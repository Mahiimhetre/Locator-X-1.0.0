importScripts('../config/plans.js');
importScripts('../services/plan-service.js');

// Create context menus on installation
chrome.runtime.onInstalled.addListener(() => {
    // ... (existing creation logic is fine)
    chrome.contextMenus.create({
        id: "locator-x-parent",
        title: "Locator-X",
        contexts: ["all"]
    });

    const categories = [
        { id: "copy-id", title: "Copy ID" },
        { id: "copy-name", title: "Copy Name" },
        { id: "copy-class", title: "Copy Class Name" },
        { id: "copy-rel-xpath", title: "Copy Relative XPath" },
        { id: "copy-css", title: "Copy CSS Selector" },
        { id: "copy-js-path", title: "Copy JS Path" },
        { id: "copy-abs-xpath", title: "Copy Absolute XPath" }
    ];

    categories.forEach(cat => {
        chrome.contextMenus.create({
            id: cat.id,
            parentId: "locator-x-parent",
            title: cat.title,
            contexts: ["all"]
        });

        // Create child item for the actual value
        chrome.contextMenus.create({
            id: `${cat.id}-value`,
            parentId: cat.id,
            title: "Scanning...",
            contexts: ["all"],
            visible: false // Only show when a value is found
        });
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // ... (existing click handler)
    if (info.menuItemId.endsWith('-value')) {
        const type = info.menuItemId.replace('-value', '');
        chrome.tabs.sendMessage(tab.id, {
            action: 'contextMenuLocator',
            type: type
        }).catch(() => { });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateContextMenuValues') {
        // Access plan from storage - Secure Source of Truth
        planService.init().then(() => {
            const categories = [
                'copy-id', 'copy-name', 'copy-class', 'copy-rel-xpath',
                'copy-css', 'copy-js-path', 'copy-abs-xpath'
            ];

            categories.forEach(catId => {
                const shortType = catId.replace('copy-', '');
                const typeMap = {
                    'id': 'id',
                    'name': 'name',
                    'class': 'className',
                    'rel-xpath': 'xpath',
                    'css': 'css',
                    'js-path': 'jsPath',
                    'abs-xpath': 'absoluteXPath'
                };

                // Determine feature key for this type
                let featureKey = null;
                if (shortType === 'id') featureKey = 'locator.id';
                else if (shortType === 'name') featureKey = 'locator.name';
                else if (shortType === 'class') featureKey = 'locator.css';
                else if (shortType === 'css') featureKey = 'locator.css';
                else if (shortType === 'rel-xpath') featureKey = 'locator.xpath.relative';
                else if (shortType === 'abs-xpath') featureKey = 'locator.xpath';
                else if (shortType === 'js-path') featureKey = 'locator.playwright'; // Updated to match plans.js

                const value = message.values[typeMap[shortType]];
                const isEnabled = featureKey ? planService.isEnabled(featureKey) : true;

                if (isEnabled && value) {
                    chrome.contextMenus.update(`${catId}-value`, {
                        title: value,
                        visible: true
                    });
                } else {
                    chrome.contextMenus.update(`${catId}-value`, {
                        visible: false
                    });
                }
            });
        });

    } else if (message.action === 'locatorsGenerated' || message.action === 'deactivateInspect') {
        chrome.runtime.sendMessage(message).catch(() => { });
    } else if (message.action === 'broadcastToTab') {
        // Broadcast a message to ALL frames of the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.id) {
                chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                    frames.forEach(frame => {
                        chrome.tabs.sendMessage(tab.id, message.payload, { frameId: frame.frameId }).catch(() => { });
                    });
                });
            }
        });
    } else if (message.action === 'notification') {
        // Notification logic
    }
    return true;
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});


// Handle External Messages from Website (Auth & Plan Sync)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    // Verify source if needed (sender.url) - matches externally_connectable

    if (message.action === 'LOGIN_SUCCESS') {
        const { token, user } = message.payload;

        if (token && user) {
            // Securely store token and user data
            chrome.storage.local.set({
                authToken: token,
                user: user,
                'locator-x-plan': user.plan || 'free'
            }, () => {
                sendResponse({ success: true });
                // Broadcast change to all views (Sidepanel, DevTools, Popup)
                chrome.runtime.sendMessage({ action: 'AUTH_STATE_CHANGED', user: user });
            });
        } else {
            sendResponse({ success: false, error: 'Invalid payload' });
        }
    } else if (message.action === 'SYNC_PLAN') {
        const { plan } = message.payload;
        if (plan) {
            chrome.storage.local.set({ 'locator-x-plan': plan }, () => {
                sendResponse({ success: true, plan: plan });
                // We might want to broadcast plan changes too, but usually AUTH_STATE_CHANGED covers it if user re-fetches
            });
        }
    } else if (message.action === 'LOGOUT') {
        chrome.storage.local.remove(['authToken', 'user', 'locator-x-plan'], () => {
            sendResponse({ success: true });
            chrome.runtime.sendMessage({ action: 'AUTH_STATE_CHANGED', user: null });
        });
    }
    return true; // Keep channel open for async response
});

// Also listen for runtime messages (from content script) for the same actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'LOGIN_SUCCESS') {
        const { token, user } = message.payload;
        if (token && user) {
            chrome.storage.local.set({
                authToken: token,
                user: user,
                'locator-x-plan': user.plan || 'free'
            }, () => {
                // Notify views?
            });
        }
    } else if (message.action === 'LOGOUT') {
        chrome.storage.local.remove(['authToken', 'user', 'locator-x-plan']);
    }
});

// Handle sidepanel cleanup on close
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'locatorx-panel') {
        port.onDisconnect.addListener(() => {
            // Panel closed -> stop scanning in current active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'stopScanning' }).catch(() => { });
                }
            });
        });
    }
});