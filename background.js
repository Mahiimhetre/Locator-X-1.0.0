// Port management for extension lifecycle
let activePorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
    activePorts.add(port);

    port.onDisconnect.addListener(() => {
        activePorts.delete(port);
        // If no more extension ports are open, stop scanning in all tabs
        if (activePorts.size === 0) {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'stopScanning' }).catch(() => { });
                });
            });
        }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'locatorsGenerated' || message.action === 'deactivateInspect') {
        chrome.runtime.sendMessage(message).catch(() => { });
    }
    return true;
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});