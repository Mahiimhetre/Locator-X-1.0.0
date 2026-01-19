/**
 * Locator-X Plans Configuration
 * 
 * This file serves as the IMMUTABLE source of truth for all feature gating and limits.
 * It is hardcoded into the extension to prevent client-side tampering.
 */

const LocatorXPlans = {
    TIERS: {
        FREE: 'free',
        PRO: 'pro',
        TEAM: 'team'
    },

    METADATA: {
        free: {
            name: 'Free',
            badge: 'Basic',
            upgradeUrl: 'https://locator-x.com/pricing'
        },
        pro: {
            name: 'Pro',
            badge: 'Pro',
            upgradeUrl: 'https://locator-x.com/pricing'
        },
        team: {
            name: 'Team',
            badge: 'Team',
            upgradeUrl: 'https://locator-x.com/contact-sales'
        }
    },

    // Boolean feature flags
    FEATURES: {
        free: [
            'locator.id',
            'locator.name',
            'locator.className',
            'locator.tagname',
            'locator.linkText',
            'locator.partialLinkText',
            'locator.jsPath',
            'locator.css',
            'locator.absoluteXpath',
            'locator.relativeXpath',
            'locator.containsXpath',
            'locator.indexedXpath',
            'locator.linkTextXpath',
            'locator.partialLinkTextXpath',
            'locator.attributeXpath',
            'locator.cssXpath',
            'locator.playwright',
            'locator.cypress',
            'module.inspect',
            'module.saved',
            'module.history',
            'module.multiScan',
            'module.pom',
            'module.axes',
            'ui.theme.light',
            'ui.copy',
            'ui.save'
        ],
        get pro() {
            return [
                ...this.free,
                // Pro Features
                'ui.export',
                'ui.theme.dark',
                'ui.settings.framework',
                'ui.settings.reset',
                'ui.settings.excludeNumbers',
                'ui.quickEdit'
            ];
        },
        team: 'ALL' // Grants access to everything
    },

    // Numeric and logic limits
    LIMITS: {
        free: {
            MAX_SAVED_LOCATORS: 25,
            MAX_POM_PAGES: 3,
            MAX_HISTORY_ITEMS: 50
        },
        pro: {
            MAX_SAVED_LOCATORS: Infinity,
            MAX_POM_PAGES: Infinity,
            MAX_HISTORY_ITEMS: 200
        },
        team: {
            MAX_SAVED_LOCATORS: Infinity,
            MAX_POM_PAGES: Infinity,
            MAX_HISTORY_ITEMS: 1000
        }
    }
};

// Universal Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXPlans;
} else if (typeof window !== 'undefined') {
    window.LocatorXPlans = LocatorXPlans;
} else if (typeof self !== 'undefined') {
    self.LocatorXPlans = LocatorXPlans;
}
