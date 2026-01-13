// Auth Sync Content Script
// Runs on the website to sync auth state with the extension

const EXTENSION_ID = chrome.runtime.id;
const USERS_KEY = 'locatorx_current_user'; // Matches website implementation


// Listen for storage changes from the website
window.addEventListener('storage', (event) => {
    if (event.key === USERS_KEY) {
        syncAuthState();
    }
});

// Listen for custom events from the website (using document for better reliability)
document.addEventListener('SYNC_LOCATOR_X', (event) => {
    console.log('Locator-X Content Script: Caught sync event', event.detail);
    if (event.detail) {
        syncAuthState(event.detail);
    }
});

// Also check on load and periodically
syncAuthState();

// Monkey patch localStorage to detect direct setItem calls in the same window
const originalSetItem = localStorage.setItem;
localStorage.setItem = function (key, value) {
    const event = new Event('storage');
    event.key = key;
    event.newValue = value;
    originalSetItem.apply(this, arguments);
    if (key === USERS_KEY) {
        syncAuthState();
    }
};

const originalRemoveItem = localStorage.removeItem;
localStorage.removeItem = function (key) {
    const event = new Event('storage');
    event.key = key;
    event.newValue = null;
    originalRemoveItem.apply(this, arguments);
    if (key === USERS_KEY) {
        syncAuthState();
    }
};


function syncAuthState(providedUser = null) {
    try {
        const user = providedUser || JSON.parse(localStorage.getItem(USERS_KEY) || 'null');

        if (user) {
            console.log('Locator-X Sync: Syncing user', user);

            // Send to background using SYNC_PROFILE for safe merging
            chrome.runtime.sendMessage({
                action: 'SYNC_PROFILE',
                payload: {
                    user: user
                }
            });
        } else {
            console.log('Locator-X Sync: User logged out');
            // Send logout
            chrome.runtime.sendMessage({
                action: 'LOGOUT'
            });
        }
    } catch (e) {
        console.error('Locator-X Sync: Error syncing auth state', e);
    }
}
