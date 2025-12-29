// Create context menus on installation
chrome.runtime.onInstalled.addListener(() => {
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
    // If user clicks a "value" item, we copy its title to clipboard
    if (info.menuItemId.endsWith('-value')) {
        // The title would have been set to the actual locator value
        // Note: info.menuItemTitle is not available in onClicked, so we need a different approach
        // or just communicate back to content script to copy.
        // Actually, let's just use the current type-based message and the content script will copy the specific type.
        const type = info.menuItemId.replace('-value', '');
        chrome.tabs.sendMessage(tab.id, {
            action: 'contextMenuLocator',
            type: type
        }).catch(() => { });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateContextMenuValues') {
        const categories = [
            'copy-id', 'copy-name', 'copy-class', 'copy-rel-xpath',
            'copy-css', 'copy-js-path', 'copy-abs-xpath'
        ];

        // Access plan from storage
        chrome.storage.local.get(['locator-x-plan'], (result) => {
            const plan = result['locator-x-plan'] || 'free';
            const isPro = plan !== 'free'; // Simple check for now (pro/team are 'not free')

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

                const value = message.values[typeMap[shortType]];

                // If Pro/Team AND value exists, show the value item
                if (isPro && value) {
                    chrome.contextMenus.update(`${catId}-value`, {
                        title: value,
                        visible: true
                    });
                } else {
                    // Start Hidden for Free users OR if no value
                    // BUT, actually if it's Free user, we might want to NOT show the "value" item at all.
                    // The "value" item is a child Item.
                    chrome.contextMenus.update(`${catId}-value`, {
                        visible: false
                    });
                }
            });
        });

    } else if (message.action === 'locatorsGenerated' || message.action === 'deactivateInspect') {
        chrome.runtime.sendMessage(message).catch(() => { });
    } else if (message.action === 'notification') {
        // Notification logic
    }
    return true;
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Handle sidepanel cleanup on close
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidepanel') {
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