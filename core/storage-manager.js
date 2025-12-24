// Core Storage Manager - Backend Logic
class StorageManager {
    constructor(storagePrefix = 'locator-x') {
        this.prefix = storagePrefix;
    }

    // Saved Locators Management
    getSavedLocators() {
        return JSON.parse(localStorage.getItem(`${this.prefix}-saved`) || '[]');
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
        
        localStorage.setItem(`${this.prefix}-saved`, JSON.stringify(saved));
        return existing ? 'updated' : 'created';
    }

    deleteLocator(id) {
        const saved = this.getSavedLocators();
        const filtered = saved.filter(item => item.id !== id);
        localStorage.setItem(`${this.prefix}-saved`, JSON.stringify(filtered));
        return saved.length !== filtered.length;
    }

    // POM Pages Management
    getPOMPages() {
        return JSON.parse(localStorage.getItem(`${this.prefix}-pom-pages`) || '[]');
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
        
        localStorage.setItem(`${this.prefix}-pom-pages`, JSON.stringify(pages));
        return existingIndex !== -1 ? 'updated' : 'created';
    }

    deletePOMPage(pageId) {
        const pages = this.getPOMPages();
        const filtered = pages.filter(p => p.id !== pageId);
        localStorage.setItem(`${this.prefix}-pom-pages`, JSON.stringify(filtered));
        return pages.length !== filtered.length;
    }

    // Settings Management
    getSettings() {
        return JSON.parse(localStorage.getItem(`${this.prefix}-settings`) || '{}');
    }

    saveSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        localStorage.setItem(`${this.prefix}-settings`, JSON.stringify(settings));
    }

    getSetting(key, defaultValue = null) {
        const settings = this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    // Filter State Management
    getFilterState(tab) {
        return JSON.parse(localStorage.getItem(`${this.prefix}-filters-${tab}`) || '{}');
    }

    saveFilterState(tab, filters) {
        localStorage.setItem(`${this.prefix}-filters-${tab}`, JSON.stringify(filters));
    }

    // History Management
    getHistory() {
        return JSON.parse(localStorage.getItem(`${this.prefix}-history`) || '[]');
    }

    addToHistory(item) {
        const history = this.getHistory();
        history.unshift({
            ...item,
            id: Date.now(),
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 items
        if (history.length > 50) {
            history.splice(50);
        }
        
        localStorage.setItem(`${this.prefix}-history`, JSON.stringify(history));
    }

    clearHistory() {
        localStorage.removeItem(`${this.prefix}-history`);
    }

    // Theme Management
    getTheme() {
        return localStorage.getItem(`${this.prefix}-theme`) || 'light';
    }

    saveTheme(theme) {
        localStorage.setItem(`${this.prefix}-theme`, theme);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
} else {
    window.StorageManager = StorageManager;
}