class LocatorXFeatures {
    constructor() {
        this.currentPlan = 'free';

        // Comprehensive Feature Registry
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
        // For now, load from local storage or default to free
        // In future, this will sync with auth.js
        this.currentPlan = localStorage.getItem('locator-x-plan') || 'free';
        console.log(`LocatorX: Initialized with plan '${this.currentPlan}'`);

        // Expose for debugging
        window.setPlan = (plan) => {
            if (this.config[plan]) {
                this.currentPlan = plan;
                localStorage.setItem('locator-x-plan', plan);
                this.applyFeatureGates();
                // Notifications might not be available in all contexts, so check
                if (window.LocatorX && window.LocatorX.notifications) {
                    LocatorX.notifications.success(`Switched to ${plan.toUpperCase()} plan`);
                } else {
                    console.log(`Switched to ${plan}`);
                }
                setTimeout(() => location.reload(), 500);
            }
        };

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

        if (showNotification && window.LocatorX && window.LocatorX.notifications) {
            LocatorX.notifications.info(
                `Upgrade to Pro to access this feature!`,
                'Feature Locked'
            );
        }
        return false;
    }

    applyFeatureGates() {
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
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            if (!this.isEnabled('ui.theme.dark')) {
                themeBtn.style.display = 'none';
            } else {
                themeBtn.style.display = 'flex'; // Or whatever flex/block it was
            }
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXFeatures;
} else {
    window.LocatorXFeatures = LocatorXFeatures;
}
