// Minimal Background Script for Extension Communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Forward messages between content script, sidepanel, and devtools
    if (message.action === 'locatorsGenerated' || message.action === 'deactivateInspect') {
        // Broadcast to all extension contexts
        chrome.runtime.sendMessage(message).catch(() => {});
    }
    return true;
});

// Handle extension icon click to open sidepanel
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});