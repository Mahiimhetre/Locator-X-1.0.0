// DevTools Integration - Creates panel and syncs with sidepanel
chrome.devtools.panels.create(
    'Locator-X',
    'assets/default.jpg',
    'sidepanel/panel.html',
    (panel) => {
        // Panel created - sync with sidepanel via storage
        panel.onShown.addListener(() => {
            // DevTools panel is shown
            chrome.storage.local.set({ devtoolsActive: true });
        });
        
        panel.onHidden.addListener(() => {
            // DevTools panel is hidden
            chrome.storage.local.set({ devtoolsActive: false });
        });
    }
);