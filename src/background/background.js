importScripts('../config/plans.js');
importScripts('../services/plan-service.js');

// Create context menus on installation
// Setup context menus based on plan
// Setup context menus based on plan
const setupContextMenus = async () => {
    await planService.init();

    // Check if context menu is enabled at all (Free feature)
    if (!planService.isEnabled('ui.contextMenu')) {
        chrome.contextMenus.removeAll();
        return;
    }

    const isNested = planService.isEnabled('ui.contextMenu.nested');

    chrome.contextMenus.removeAll(() => {
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
            { id: "copy-jquery", title: "Copy jQuery" },
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

            if (isNested) {
                chrome.contextMenus.create({
                    id: `${cat.id}-value`,
                    parentId: cat.id,
                    title: "Scanning...",
                    contexts: ["all"],
                    visible: false
                });
            }
        });
    });
};

// Create context menus on installation & startup
chrome.runtime.onInstalled.addListener(() => {
    setupContextMenus();
    chrome.storage.local.set({ devtoolsActive: false });
});

chrome.runtime.onStartup.addListener(() => {
    setupContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // 1. Deep Nested Click (Pro)
    if (info.menuItemId.endsWith('-value')) {
        const type = info.menuItemId.replace('-value', '');
        chrome.tabs.sendMessage(tab.id, {
            action: 'contextMenuLocator',
            type: type
        }).catch(() => { });
    }
    // 2. Direct Category Click (Free - when flattened)
    else if (info.parentMenuItemId === "locator-x-parent") {
        // If nested is OFF, these are clickable actions.
        planService.init().then(() => {
            if (!planService.isEnabled('ui.contextMenu.nested')) {
                const type = info.menuItemId.replace('copy-', '');
                chrome.tabs.sendMessage(tab.id, {
                    action: 'contextMenuLocator',
                    type: 'copy-' + type // Ensuring consistency with type expectations
                }).catch(() => { });
            }
        });
    }
});

// Centralized Auth/Sync Logic
const handleAuthSync = (message, sendResponse) => {
    if (message.action === 'LOGIN_SUCCESS') {
        const { token, user } = message.payload;
        if (token && user) {
            chrome.storage.local.set({
                authToken: token,
                user: user,
                'locator-x-plan': user.plan || 'free'
            }, () => {
                chrome.runtime.sendMessage({ action: 'AUTH_STATE_CHANGED', user: user }).catch(() => { });
                setupContextMenus(); // Rebuild menus
                sendResponse({ success: true });
            });
            return true;
        } else {
            sendResponse({ success: false, error: 'Invalid payload' });
        }
    } else if (message.action === 'SYNC_PLAN') {
        const { plan } = message.payload;
        if (plan) {
            chrome.storage.local.get(['user'], (result) => {
                const updates = { 'locator-x-plan': plan };
                let updatedUser = null;
                if (result.user) {
                    updatedUser = { ...result.user, plan: plan, _lastUpdated: Date.now() };
                    updates.user = updatedUser;
                }
                chrome.storage.local.set(updates, () => {
                    chrome.runtime.sendMessage({ action: 'AUTH_STATE_CHANGED', user: updatedUser }).catch(() => { });
                    setupContextMenus(); // Rebuild menus
                    sendResponse({ success: true, plan: plan });
                });
            });
            return true;
        }
    } else if (message.action === 'SYNC_PROFILE') {
        const { user } = message.payload;
        if (user) {
            chrome.storage.local.get(['user', 'authToken'], (result) => {
                const updatedUser = { ...result.user, ...user, _lastUpdated: Date.now() };
                const updates = {
                    user: updatedUser,
                    'locator-x-plan': updatedUser.plan || 'free'
                };
                if (!result.authToken) {
                    updates.authToken = 'dummy-token-for-sync';
                }
                chrome.storage.local.set(updates, () => {
                    chrome.runtime.sendMessage({ action: 'AUTH_STATE_CHANGED', user: updatedUser }).catch(() => { });
                    setupContextMenus(); // Rebuild menus
                    sendResponse({ success: true });
                });
            });
            return true;
        }
    } else if (message.action === 'LOGOUT') {
        chrome.storage.local.remove(['authToken', 'user', 'locator-x-plan'], () => {
            chrome.runtime.sendMessage({ action: 'AUTH_STATE_CHANGED', user: null }).catch(() => { });
            setupContextMenus(); // Rebuild menus
            sendResponse({ success: true });
        });
        return true;
    }
    return false;
};

// Internal Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (['LOGIN_SUCCESS', 'SYNC_PLAN', 'SYNC_PROFILE', 'LOGOUT'].includes(message.action)) {
        return handleAuthSync(message, sendResponse);
    }

    if (message.action === 'updateContextMenuValues') {
        planService.init().then(() => {
            const isNested = planService.isEnabled('ui.contextMenu.nested');
            if (!isNested) {
                sendResponse({ success: true });
                return;
            }

            const categories = ['copy-id', 'copy-name', 'copy-class', 'copy-rel-xpath', 'copy-css', 'copy-jquery', 'copy-js-path', 'copy-abs-xpath'];
            categories.forEach(catId => {
                const shortType = catId.replace('copy-', '');
                const typeMap = { 'id': 'id', 'name': 'name', 'class': 'className', 'rel-xpath': 'relativeXpath', 'css': 'css', 'jquery': 'jquery', 'js-path': 'jsPath', 'abs-xpath': 'absoluteXpath' };
                let featureKey = null;
                if (shortType === 'id') featureKey = 'locator.id';
                else if (shortType === 'name') featureKey = 'locator.name';
                else if (shortType === 'class' || shortType === 'css') featureKey = 'locator.css';
                else if (shortType === 'jquery') featureKey = 'locator.jquery';
                else if (shortType === 'rel-xpath') featureKey = 'locator.relativeXpath';
                else if (shortType === 'abs-xpath') featureKey = 'locator.absoluteXpath';
                else if (shortType === 'js-path') featureKey = 'locator.jsPath';

                const value = message.values[typeMap[shortType]];
                const isEnabled = featureKey ? planService.isEnabled(featureKey) : true;

                if (isEnabled && value) {
                    chrome.contextMenus.update(`${catId}-value`, { title: value, visible: true }, () => {
                        if (chrome.runtime.lastError) { /* ignore if item missing */ }
                    });
                } else {
                    chrome.contextMenus.update(`${catId}-value`, { visible: false }, () => {
                        if (chrome.runtime.lastError) { /* ignore if item missing */ }
                    });
                }
            });
            sendResponse({ success: true });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    } else if (message.action === 'locatorsGenerated' || message.action === 'deactivateInspect') {
        chrome.runtime.sendMessage(message).catch(() => { });
        sendResponse({ success: true });
    } else if (message.action === 'broadcastToTab') {
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
        sendResponse({ success: true });
    }
    return false;
});

// External Message Listener
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    console.log('Background: Received external message', message.action, message);
    if (['LOGIN_SUCCESS', 'SYNC_PLAN', 'SYNC_PROFILE', 'LOGOUT'].includes(message.action)) {
        return handleAuthSync(message, sendResponse);
    }
    return false;
});

// Icon click -> Open Sidepanel
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Handle sidepanel cleanup on close
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'locatorx-panel') {
        port.onDisconnect.addListener(() => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'stopScanning', force: true }).catch(() => { });
                }
            });
        });
    }

    if (port.name === 'locatorx-devtools') {
        port.onDisconnect.addListener(() => {
            chrome.storage.local.set({ devtoolsActive: false });
        });
    }
});