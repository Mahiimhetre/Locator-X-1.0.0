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

    // Display names for locator strategies
    STRATEGY_NAMES: {
        'id': 'ID',
        'name': 'Name',
        'className': 'ClassName',
        'tagname': 'TagName',
        'css': 'CSS',
        'linkText': 'Link Text',
        'partialLinkText': 'Partial Link Text',
        'absoluteXPath': 'Absolute XPath',
        'xpath': 'Relative XPath',
        'containsXpath': 'Contains XPath',
        'indexedXpath': 'Indexed XPath',
        'linkTextXpath': 'Link Text XPath',
        'partialLinkTextXpath': 'Partial Link XPath',
        'attributeXpath': 'Attribute XPath',
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
