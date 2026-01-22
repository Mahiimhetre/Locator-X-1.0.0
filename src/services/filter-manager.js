// Core Filter Manager - Backend Logic
class FilterManager {
    constructor() {
        this.filterRules = {
            framework: {
                cypress: {
                    disabled: ['linkText', 'pLinkText'],
                    enabled: ['css', 'xpath']
                },
                playwright: {
                    enabled: ['css', 'xpath', 'id', 'className']
                },
                selenium: {
                    enabled: ['id', 'name', 'className', 'css', 'xpath', 'linkText', 'pLinkText']
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

    getEnabledFilters(filterState) {
        return Object.keys(filterState).filter(key =>
            filterState[key].enabled && !filterState[key].disabled
        );
    }

    validateFilterCombination(filters, framework) {
        const frameworkRules = this.filterRules.framework[framework];

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

    getRecommendedFilters(framework) {
        const frameworkRules = this.filterRules.framework[framework] || {};

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

        return recommended;
    }

    createDefaultFilterState() {
        const defaults = {};
        if (typeof LocatorXConfig !== 'undefined' && LocatorXConfig.STRATEGY_NAMES) {
            Object.keys(LocatorXConfig.STRATEGY_NAMES).forEach(key => {
                defaults[key] = { enabled: true, disabled: false };
            });
            // Ensure absolute is there if not in strategy names (it's usually separate)
            if (!defaults['absoluteXPath']) {
                defaults['absoluteXPath'] = { enabled: true, disabled: false };
            }
        } else {
            // Fallback
            return {
                id: { enabled: true, disabled: false },
                name: { enabled: true, disabled: false },
                className: { enabled: true, disabled: false },
                tagname: { enabled: true, disabled: false },
                css: { enabled: true, disabled: false },
                xpath: { enabled: true, disabled: false },
                linkText: { enabled: true, disabled: false },
                pLinkText: { enabled: true, disabled: false },
                absoluteXPath: { enabled: true, disabled: false }
            };
        }
        return defaults;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterManager;
} else {
    window.FilterManager = FilterManager;
}