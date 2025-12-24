// Core API - Main Backend Interface
class LocatorXCore {
    constructor() {
        this.generator = new LocatorGenerator();
        this.storage = new StorageManager();
        this.filterManager = new FilterManager();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        // Load saved settings
        this.settings = this.storage.getSettings();
        this.theme = this.storage.getTheme();
        
        this.initialized = true;
    }

    // Locator Generation
    async generateLocators(element, options = {}) {
        const enabledFilters = options.filters || this.getEnabledFilters();
        const locators = this.generator.generateLocators(element, {
            strategies: enabledFilters
        });
        
        // Add to history
        this.storage.addToHistory({
            type: 'generation',
            element: this.getElementInfo(element),
            locators: locators,
            filters: enabledFilters
        });
        
        return locators;
    }

    // Filter Management
    getEnabledFilters(tab = 'home') {
        const filterState = this.storage.getFilterState(tab);
        return this.filterManager.getEnabledFilters(filterState);
    }

    updateFilters(tab, filters) {
        this.storage.saveFilterState(tab, filters);
        
        // Validate with current framework/language
        const framework = this.getSetting('framework', 'unknown');
        const language = this.getSetting('language', 'unknown');
        
        return this.filterManager.validateFilterCombination(
            this.getEnabledFilters(tab), 
            framework, 
            language
        );
    }

    applyDependencyRules(framework, language) {
        const defaultFilters = this.filterManager.createDefaultFilterState();
        
        let homeFilters = this.filterManager.applyFrameworkRules(framework, defaultFilters);
        homeFilters = this.filterManager.applyLanguageRules(language, homeFilters);
        
        let pomFilters = { ...homeFilters };
        
        this.storage.saveFilterState('home', homeFilters);
        this.storage.saveFilterState('pom', pomFilters);
        
        return { homeFilters, pomFilters };
    }

    // Settings Management
    getSetting(key, defaultValue = null) {
        return this.storage.getSetting(key, defaultValue);
    }

    saveSetting(key, value) {
        this.storage.saveSetting(key, value);
        
        // Apply dependency rules if framework or language changed
        if (key === 'framework' || key === 'language') {
            const framework = this.getSetting('framework', 'unknown');
            const language = this.getSetting('language', 'unknown');
            return this.applyDependencyRules(framework, language);
        }
    }

    // Saved Locators Management
    getSavedLocators() {
        return this.storage.getSavedLocators();
    }

    saveLocator(name, type, locator) {
        return this.storage.saveLocator({
            name: name || this.generateAutoName(),
            type,
            locator
        });
    }

    deleteLocator(id) {
        return this.storage.deleteLocator(id);
    }

    // Theme Management
    getTheme() {
        return this.storage.getTheme();
    }

    setTheme(theme) {
        this.storage.saveTheme(theme);
        this.theme = theme;
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    }

    // History Management
    getHistory() {
        return this.storage.getHistory();
    }

    clearHistory() {
        this.storage.clearHistory();
    }

    // Utility Methods
    generateAutoName() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    getElementInfo(element) {
        return {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textContent: element.textContent?.slice(0, 50)
        };
    }

    // Validation
    validateLocator(locator, type) {
        try {
            if (type === 'css') {
                document.querySelector(locator);
            } else if (type === 'xpath') {
                document.evaluate(locator, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Export/Import
    exportData() {
        return {
            saved: this.getSavedLocators(),
            settings: this.storage.getSettings(),
            history: this.getHistory(),
            version: '1.0.0'
        };
    }

    importData(data) {
        if (data.saved) {
            localStorage.setItem('locator-x-saved', JSON.stringify(data.saved));
        }
        if (data.settings) {
            localStorage.setItem('locator-x-settings', JSON.stringify(data.settings));
        }
        if (data.history) {
            localStorage.setItem('locator-x-history', JSON.stringify(data.history));
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXCore;
} else {
    window.LocatorXCore = LocatorXCore;
}