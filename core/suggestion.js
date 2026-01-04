// Core Suggestion Logic - Backend for the Search Dropdown
class SuggestionManager {
    constructor() {
        this.context = {
            tags: {},
            ids: {},
            classes: {},
            attributes: {},
            textFragments: []
        };

        this.xpathAxes = [
            'ancestor::', 'ancestor-or-self::', 'attribute::', 'child::',
            'descendant::', 'descendant-or-self::', 'following::',
            'following-sibling::', 'parent::', 'preceding::',
            'preceding-sibling::', 'self::'
        ];

        this.xpathFunctions = [
            'contains()', 'text()', 'starts-with()', 'ends-with()',
            'normalize-space()', 'last()', 'position()', 'count()',
            'not()', 'string-length()', 'substring()', 'translate()'
        ];
    }

    updatePageContext(structure) {
        this.context = structure || {
            tags: {}, ids: {}, classes: {}, attributes: {}, textFragments: []
        };
    }

    getSuggestions(query) {
        const lowerQuery = query.toLowerCase().trim();
        const suggestions = [];
        const maxSuggestions = 50; // Increased limit slightly

        // Helper to add unique suggestions
        const seen = new Set();
        const add = (text, category, count) => {
            if (seen.has(text)) return;
            seen.add(text);
            suggestions.push({ type: text, category, count });
        };

        if (!lowerQuery) {
            // Default: popular tags and IDs
            this._addRawMatches(suggestions, this.context.tags, 'Tag', '', seen);
            this._addRawMatches(suggestions, this.context.ids, 'ID', '#', seen);
            return suggestions.slice(0, 15);
        }

        // --- 1. Collect All Candidates & Check Matches ---

        // Tags
        this._processCategory(this.context.tags, 'Tag', '', lowerQuery, add);

        // IDs
        this._processCategory(this.context.ids, 'ID', '#', lowerQuery, add);

        // Classes
        this._processCategory(this.context.classes, 'Class', '.', lowerQuery, add);

        // Attributes
        if (this.context.attributes) {
            Object.entries(this.context.attributes).forEach(([attr, values]) => {
                this._processCategory(values, 'Attribute', `[@${attr}='`, lowerQuery, add, "']");
            });
        }

        // Text Fragments
        if (this.context.textFragments) {
            this.context.textFragments.forEach(text => {
                const count = 1;
                const xpath = `//*[text()='${text}']`;

                // Match against text OR the generated XPath
                if (text.toLowerCase().includes(lowerQuery) || xpath.toLowerCase().includes(lowerQuery)) {
                    add(xpath, 'Text', count);
                    // Also generate framework wrappers for text
                    this._generateFrameworkWrappers(xpath, 'Text', count, lowerQuery, add);
                }
            });
        }

        // XPath Axes & Functions
        this.xpathAxes.concat(this.xpathFunctions).forEach(item => {
            if (item.toLowerCase().includes(lowerQuery)) {
                add(item, 'XPath', 'Axis/Func');
            }
        });

        // Sort: Exact matches first, then starts-with, then includes
        return suggestions.sort((a, b) => {
            const aType = a.type.toLowerCase();
            const bType = b.type.toLowerCase();
            const aExact = aType === lowerQuery;
            const bExact = bType === lowerQuery;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = aType.startsWith(lowerQuery);
            const bStarts = bType.startsWith(lowerQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return 0;
        }).slice(0, 30);
    }

    _addRawMatches(list, source, category, prefix, seen) {
        if (!source) return;
        Object.entries(source).forEach(([key, count]) => {
            const val = prefix + key;
            if (!seen.has(val)) {
                seen.add(val);
                list.push({ type: val, category, count });
            }
        });
    }

    // Process a category: generate raw + framework wrappers and check query
    _processCategory(source, category, prefix, query, addFn, suffix = '') {
        if (!source) return;

        Object.entries(source).forEach(([key, count]) => {
            const rawValue = prefix + key + suffix;

            // 1. Check Raw Match
            if (rawValue.toLowerCase().includes(query)) {
                addFn(rawValue, category, count);
            }

            // 2. Generate and Check Framework Wrappers
            // We pass the rawValue (e.g. #myId or .myClass) to the generator
            this._generateFrameworkWrappers(rawValue, category, count, query, addFn);
        });
    }

    _generateFrameworkWrappers(rawValue, category, count, query, addFn) {
        // Selenium
        let seleniumStr = '';
        if (rawValue.startsWith('#')) {
            seleniumStr = `By.id('${rawValue.substring(1)}')`;
        } else if (rawValue.startsWith('.')) {
            seleniumStr = `By.className('${rawValue.substring(1)}')`;
        } else if (rawValue.startsWith('//') || rawValue.startsWith('(')) {
            seleniumStr = `By.xpath('${rawValue}')`;
        } else if (category === 'Tag') {
            seleniumStr = `By.tagName('${rawValue}')`;
        }

        if (seleniumStr && seleniumStr.toLowerCase().includes(query)) {
            addFn(seleniumStr, 'Selenium', count);
        }

        // Cypress
        const cyGet = `cy.get('${rawValue}')`;
        if (cyGet.toLowerCase().includes(query)) {
            addFn(cyGet, 'Cypress', count);
        }

        if (category === 'Text') {
            // cy.contains
            // rawValue is //*[text()='...']
            // Extract the text content
            const match = rawValue.match(/text\(\)='(.*)'/);
            if (match && match[1]) {
                const cyContains = `cy.contains('${match[1]}')`;
                if (cyContains.toLowerCase().includes(query)) {
                    addFn(cyContains, 'Cypress', count);
                }
            }
        }

        // Playwright
        const pwLocator = `page.locator('${rawValue}')`;
        if (pwLocator.toLowerCase().includes(query)) {
            addFn(pwLocator, 'Playwright', count);
        }

        if (category === 'ID') {
            const pwId = `page.getByTestId('${rawValue.substring(1)}')`;
            if (pwId.toLowerCase().includes(query)) {
                addFn(pwId, 'Playwright', count);
            }
        }
        if (category === 'Text') {
            const match = rawValue.match(/text\(\)='(.*)'/);
            if (match && match[1]) {
                const pwText = `page.getByText('${match[1]}')`;
                if (pwText.toLowerCase().includes(query)) {
                    addFn(pwText, 'Playwright', count);
                }
            }
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SuggestionManager;
} else {
    window.SuggestionManager = SuggestionManager;
}
