// Core Filter Manager - Backend Logic
class FilterManager {
    constructor() {
        this.filterRules = {
            framework: {
                cypress: {
                    disabled: ['linkText', 'partialLinkText'],
                    enabled: ['css', 'xpath']
                },
                playwright: {
                    enabled: ['css', 'xpath', 'id', 'className']
                },
                selenium: {
                    enabled: ['id', 'name', 'className', 'css', 'xpath', 'linkText', 'partialLinkText']
                }
            },
            language: {
                javascript: {
                    preferred: ['css', 'xpath']
                },
                python: {
                    preferred: ['id', 'className', 'xpath']
                },
                java: {
                    preferred: ['id', 'className', 'xpath']
                }
            }
        };
    }

    applyFrameworkRules(framework, availableFilters) {
        const rules = this.filterRules.framework[framework];
        if (!rules) return availableFilters;

        let filtered = { ...availableFilters };

        if (rules.disabled) {
            rules.disabled.forEach(filter => {
                if (filtered[filter]) {
                    filtered[filter].enabled = false;
                    filtered[filter].disabled = true;
                }
            });
        }

        if (rules.enabled) {
            rules.enabled.forEach(filter => {
                if (filtered[filter]) {
                    filtered[filter].disabled = false;
                }
            });
        }

        return filtered;
    }

    applyLanguageRules(language, availableFilters) {
        const rules = this.filterRules.language[language];
        if (!rules) return availableFilters;

        let filtered = { ...availableFilters };

        if (rules.preferred) {
            // Mark preferred filters
            rules.preferred.forEach(filter => {
                if (filtered[filter]) {
                    filtered[filter].preferred = true;
                }
            });
        }

        return filtered;
    }

    getEnabledFilters(filterState) {
        return Object.keys(filterState).filter(key => 
            filterState[key].enabled && !filterState[key].disabled
        );
    }

    validateFilterCombination(filters, framework, language) {
        const frameworkRules = this.filterRules.framework[framework];
        const languageRules = this.filterRules.language[language];

        const issues = [];

        // Check framework compatibility
        if (frameworkRules && frameworkRules.disabled) {
            frameworkRules.disabled.forEach(disabledFilter => {
                if (filters.includes(disabledFilter)) {
                    issues.push(`${disabledFilter} is not supported by ${framework}`);
                }
            });
        }

        // Check if any filters are enabled
        if (filters.length === 0) {
            issues.push('At least one locator type must be enabled');
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    getRecommendedFilters(framework, language) {
        const frameworkRules = this.filterRules.framework[framework] || {};
        const languageRules = this.filterRules.language[language] || {};

        let recommended = [];

        // Start with framework enabled filters
        if (frameworkRules.enabled) {
            recommended = [...frameworkRules.enabled];
        } else {
            // Default set
            recommended = ['id', 'className', 'css', 'xpath'];
        }

        // Remove framework disabled filters
        if (frameworkRules.disabled) {
            recommended = recommended.filter(filter => 
                !frameworkRules.disabled.includes(filter)
            );
        }

        // Prioritize language preferred filters
        if (languageRules.preferred) {
            const preferred = languageRules.preferred.filter(filter => 
                recommended.includes(filter)
            );
            const others = recommended.filter(filter => 
                !languageRules.preferred.includes(filter)
            );
            recommended = [...preferred, ...others];
        }

        return recommended;
    }

    createDefaultFilterState() {
        return {
            id: { enabled: true, disabled: false },
            name: { enabled: true, disabled: false },
            className: { enabled: true, disabled: false },
            tagname: { enabled: true, disabled: false },
            css: { enabled: true, disabled: false },
            xpath: { enabled: true, disabled: false },
            linkText: { enabled: true, disabled: false },
            partialLinkText: { enabled: true, disabled: false },
            absolute: { enabled: true, disabled: false }
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterManager;
} else {
    window.FilterManager = FilterManager;
}