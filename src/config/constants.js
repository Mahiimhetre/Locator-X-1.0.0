/**
 * Locator-X Configuration Constants
 * Centralized settings for storage, UI labels, and generation strategies.
 */
const LocatorXConfig = {
    // Storage keys for localStorage and chrome.storage
    STORAGE_KEYS: {
        PREFIX: 'locator-x',
        SAVED: 'locator-x-saved',
        POM_PAGES: 'locator-x-pom-pages',
        SETTINGS: 'locator-x-settings',
        HISTORY: 'locator-x-history',
        THEME: 'locator-x-theme',
        PLAN: 'locator-x-plan',
        AUTH_TOKEN: 'authToken',
        USER: 'user',
        FILTERS: (tab) => `locator-x-filters-${tab}`
    },

    IDENTIFIERS: {
        ROOT_ID: 'lxOverlay',
        HIGHLIGHT_ATTRIBUTE: 'lx-high',
        MATCH_ATTRIBUTE: 'lx-match',
        // Generic check that matches any ID beginning with this prefix
        ID_PREFIX: 'locatorx',
        DATA_ATTRIBUTES: ['data-locator-type', 'data-label', 'lx-high', 'lx-match']
    },

    // Display names for locator strategies
    STRATEGY_NAMES: {
        'id': 'ID',
        'name': 'Name',
        'className': 'ClassName',
        'tagname': 'TagName',
        'css': 'CSS',
        'linkText': 'Link Text',
        'pLinkText': 'Partial Link Text',
        'absoluteXPath': 'Absolute XPath',
        'xpath': 'Default',
        'containsXpath': 'Contains',
        'indexedXpath': 'Indexed',
        'linkTextXpath': 'Link Text XPath',
        'pLinkTextXpath': 'PLink Text',
        'attributeXpath': 'Attribute',
        'cssXpath': 'CSS XPath',
        'jsPath': 'JS Path'
    },

    // Attributes prioritized during CSS and XPath generation
    IMPORTANT_ATTRIBUTES: [
        'data-testid',
        'data-test',
        'data-cy',
        'aria-label',
        'name',
        'placeholder',
        'title',
        'alt',
        'role'
    ],

    // Global Filter Groups
    FILTER_GROUPS: {
        // All core locator IDs
        CORE: [
            'idLocator', 'nameLocator', 'tagnameLocator', 'classNameLocator',
            'cssLocator', 'linkTextLocator', 'pLinkTextLocator',
            'relativeXPath', 'absoluteLocator',
            'xpathLocator', 'containsXpathLocator', 'indexedXpathLocator',
            'linkTextXpathLocator', 'pLinkTextXpathLocator', 'attributeXpathLocator',
            'cssXpathLocator'
        ]
    },

    // UI and Logic limits
    LIMITS: {
        HISTORY_MAX: 50,
        TEXT_MATCH_MIN: 2,
        TEXT_MATCH_MAX: 50,
        SEARCH_MATCH_MAX: 21
    },

    // Common tag group filters
    TAG_GROUPS: {
        TEXT_CONTAINERS: ['a', 'button', 'label', 'h1', 'h2', 'h3', 'span', 'div'],
        INPUTS: ['input', 'select', 'textarea'],
        INTERACTIVE: ['a', 'button', 'input', 'select', 'textarea']
    },

    // Versioning
    VERSION: '1.0.0'
};

// Exporting for environments (Node/Extension)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXConfig;
} else {
    window.LocatorXConfig = LocatorXConfig;
}
