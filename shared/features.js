class LocatorXFeatures {
    constructor(currentPlan = 'free') {
        this.currentPlan = currentPlan;

        // Comprehensive Feature Registry
        // HARDCODED - Secure source of truth for feature definitions
        this.config = {
            free: {
                features: [
                    'locator.id',
                    'locator.name',
                    'locator.linkText',
                    'locator.css',
                    'module.inspect',
                    'module.saved',
                    'ui.theme.light',
                    'ui.copy',
                    'ui.save'
                ],
                limits: {
                    savedLocators: 25
                }
            },
            pro: {
                features: [
                    // Inherits Free
                    'locator.id', 'locator.name', 'locator.linkText', 'locator.css', 'module.inspect', 'module.saved', 'ui.theme.light', 'ui.copy', 'ui.save',
                    // Pro Features
                    'locator.xpath',
                    'locator.xpath.relative',
                    'locator.playwright',
                    'module.pom',
                    'ui.export',
                    'ui.theme.dark',
                    'ui.settings.framework',
                    'ui.settings.reset'
                ],
                limits: {
                    savedLocators: Infinity
                }
            },
            team: {
                features: 'ALL', // Special keyword for access to everything
                limits: {
                    savedLocators: Infinity
                }
            }
        };
    }

    init() {
        // Init logic for UI only - mostly just applying gates based on the plan passed to constructor
        this.applyFeatureGates();
    }

    isEnabled(featureKey) {
        const planConfig = this.config[this.currentPlan] || this.config.free;

        // "ALL" access for team/admin
        if (planConfig.features === 'ALL') return true;

        return planConfig.features.includes(featureKey);
    }

    getLimit(limitKey) {
        const planConfig = this.config[this.currentPlan] || this.config.free;
        return planConfig.limits && planConfig.limits[limitKey] !== undefined
            ? planConfig.limits[limitKey]
            : 0; // Default to 0 if not defined
    }

    check(featureKey, showNotification = true) {
        if (this.isEnabled(featureKey)) return true;

        if (showNotification && typeof window !== 'undefined' && window.LocatorX && window.LocatorX.notifications) {
            LocatorX.notifications.info(
                `Upgrade to Pro to access this feature!`,
                'Feature Locked'
            );
        }
        return false;
    }

    applyFeatureGates() {
        if (typeof document === 'undefined') return; // Skip if running in background/worker

        // 1. Data-feature attributes in HTML
        document.querySelectorAll('[data-feature]').forEach(el => {
            const feature = el.getAttribute('data-feature');
            if (!this.isEnabled(feature)) {
                el.classList.add('feature-locked');
                el.title = "Available in Pro Plan";
                // Disable inputs/buttons
                if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                    el.disabled = true;
                }
                // Prevent clicks
                el.style.pointerEvents = 'none';
                el.style.opacity = '0.5';
            } else {
                el.classList.remove('feature-locked');
                el.title = "";
                if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                    el.disabled = false;
                }
                el.style.pointerEvents = 'auto';
                el.style.opacity = '1';
            }
        });

        // 2. Specific Module Gates (can be expanded)
        this.updateThemeAccess();
    }

    updateThemeAccess() {
        if (typeof document === 'undefined') return;
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            if (!this.isEnabled('ui.theme.dark')) {
                themeBtn.style.display = 'none';
            } else {
                themeBtn.style.display = 'flex';
            }
        }
    }

    updatePlan(newPlan) {
        this.currentPlan = newPlan;
        this.applyFeatureGates();
    }
}

// Universal Export (Browser, Node, Service Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXFeatures;
} else if (typeof window !== 'undefined') {
    window.LocatorXFeatures = LocatorXFeatures;
} else if (typeof self !== 'undefined') {
    // Service Worker support
    self.LocatorXFeatures = LocatorXFeatures;
}
