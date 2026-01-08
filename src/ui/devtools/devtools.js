// DevTools Integration - Creates panel and syncs with sidepanel
/* chrome.devtools.panels.create(
    'Locator-X',
    'assets/default.jpg',
    'devtools/panel.html',
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
 ); */


// Create Sidebar Pane in Elements Panel
chrome.devtools.panels.elements.createSidebarPane(
    'Locator-X',
    (sidebar) => {
        sidebar.setPage('src/ui/devtools/devtools.html');

        sidebar.onShown.addListener(() => {
            chrome.storage.local.set({ devtoolsActive: true });
            // Establish a port to notify background script we are alive
            chrome.runtime.connect({ name: 'locatorx-devtools' });
        });

        sidebar.onHidden.addListener(() => {
            chrome.storage.local.set({ devtoolsActive: false });
        });
    }
);
