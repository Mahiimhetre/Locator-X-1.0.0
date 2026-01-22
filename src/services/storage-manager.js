// Core Storage Manager - Backend Logic
class StorageManager {
    constructor(storagePrefix = LocatorXConfig.STORAGE_KEYS.PREFIX) {
        this.prefix = storagePrefix;
    }

    // Saved Locators Management
    getSavedLocators() {
        return JSON.parse(localStorage.getItem(LocatorXConfig.STORAGE_KEYS.SAVED) || '[]');
    }

    saveLocator(locator) {
        const saved = this.getSavedLocators();
        const existing = saved.find(item => item.locator === locator.locator);

        if (existing) {
            Object.assign(existing, locator);
        } else {
            saved.push({
                ...locator,
                id: Date.now(),
                date: new Date().toISOString()
            });
        }

        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.SAVED, JSON.stringify(saved));
        return existing ? 'updated' : 'created';
    }

    deleteLocator(id) {
        const saved = this.getSavedLocators();
        const filtered = saved.filter(item => item.id !== id);
        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.SAVED, JSON.stringify(filtered));
        return saved.length !== filtered.length;
    }

    // POM Pages Management
    getPOMPages() {
        return JSON.parse(localStorage.getItem(LocatorXConfig.STORAGE_KEYS.POM_PAGES) || '[]');
    }

    savePOMPage(page) {
        const pages = this.getPOMPages();
        const existingIndex = pages.findIndex(p => p.id === page.id);

        if (existingIndex !== -1) {
            pages[existingIndex] = { ...pages[existingIndex], ...page, updatedAt: new Date().toISOString() };
        } else {
            pages.push({
                ...page,
                id: page.id || `pom_${Date.now()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.POM_PAGES, JSON.stringify(pages));
        return existingIndex !== -1 ? 'updated' : 'created';
    }

    deletePOMPage(pageId) {
        const pages = this.getPOMPages();
        const filtered = pages.filter(p => p.id !== pageId);
        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.POM_PAGES, JSON.stringify(filtered));
        return pages.length !== filtered.length;
    }

    // Settings Management
    getSettings() {
        return JSON.parse(localStorage.getItem(LocatorXConfig.STORAGE_KEYS.SETTINGS) || '{}');
    }

    saveSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    getSetting(key, defaultValue = null) {
        const settings = this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    // Filter State Management
    getFilterState(tab) {
        return JSON.parse(localStorage.getItem(LocatorXConfig.STORAGE_KEYS.FILTERS(tab)) || '{}');
    }

    saveFilterState(tab, filters) {
        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.FILTERS(tab), JSON.stringify(filters));
    }

    // History Management
    getHistory() {
        return JSON.parse(localStorage.getItem(LocatorXConfig.STORAGE_KEYS.HISTORY) || '[]');
    }

    addToHistory(item) {
        const history = this.getHistory();
        history.unshift({
            ...item,
            id: Date.now(),
            timestamp: new Date().toISOString()
        });

        // Limit history based on plan
        let max = 50; // Default fallback
        if (typeof planService !== 'undefined') {
            max = planService.getLimit('MAX_HISTORY_ITEMS') || 50;
        } else if (typeof LocatorXConfig !== 'undefined' && LocatorXConfig.LIMITS) {
            max = LocatorXConfig.LIMITS.HISTORY_MAX || 50;
        }

        if (history.length > max) {
            history.splice(max);
        }

        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.HISTORY, JSON.stringify(history));
    }

    clearHistory() {
        localStorage.removeItem(LocatorXConfig.STORAGE_KEYS.HISTORY);
    }

    // Theme Management
    getTheme() {
        return localStorage.getItem(LocatorXConfig.STORAGE_KEYS.THEME) || 'light';
    }

    saveTheme(theme) {
        localStorage.setItem(LocatorXConfig.STORAGE_KEYS.THEME, theme);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
} else {
    window.StorageManager = StorageManager;
}