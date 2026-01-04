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


function syncAuthState() {
    try {
        const userStr = localStorage.getItem(USERS_KEY);

        if (userStr) {
            const user = JSON.parse(userStr);
            console.log('Locator-X Sync: User found', user);

            // Send to background
            chrome.runtime.sendMessage({
                action: 'LOGIN_SUCCESS',
                payload: {
                    token: 'dummy-token-for-sync', // We might not have the raw token exposed, but background needs one to validate "loggedIn"
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
