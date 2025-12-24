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

        if (!lowerQuery) {
            // Default: popular tags and IDs from current DOM
            this._addCategorySuggestions(suggestions, this.context.tags, 'Tag', '');
            this._addCategorySuggestions(suggestions, this.context.ids, 'ID', '#');
            return suggestions.slice(0, 15);
        }

        // 1. Tags
        this._addCategorySuggestions(suggestions, this.context.tags, 'Tag', '', lowerQuery);

        // 2. IDs (#id)
        this._addCategorySuggestions(suggestions, this.context.ids, 'ID', '#', lowerQuery);

        // 3. Classes (.class)
        this._addCategorySuggestions(suggestions, this.context.classes, 'Class', '.', lowerQuery);

        // 4. Attributes ([name=])
        if (this.context.attributes) {
            Object.entries(this.context.attributes).forEach(([attr, values]) => {
                this._addCategorySuggestions(suggestions, values, 'Attribute', `[@${attr}='`, lowerQuery, "']");
            });
        }

        // 5. Text Fragments
        if (this.context.textFragments) {
            this.context.textFragments.forEach(text => {
                if (text.toLowerCase().includes(lowerQuery)) {
                    suggestions.push({ type: `//*[text()='${text}']`, category: 'Text', count: 1 });
                }
            });
        }

        // 6. XPath Axes & Functions
        this.xpathAxes.concat(this.xpathFunctions).forEach(item => {
            if (item.toLowerCase().includes(lowerQuery)) {
                suggestions.push({ type: item, category: 'XPath', count: 'Axis/Func' });
            }
        });

        // 7. Framework Specific Wrappers
        const rawMatches = suggestions.filter(s => s.count !== 'Axis/Func').slice(0, 5);
        const frameworkSuggestions = [];

        rawMatches.forEach(match => {
            const val = match.type;
            const count = match.count;

            // Selenium
            if (val.startsWith('#')) {
                frameworkSuggestions.push({ type: `By.id('${val.substring(1)}')`, category: 'Selenium', count });
            } else if (val.startsWith('.')) {
                frameworkSuggestions.push({ type: `By.className('${val.substring(1)}')`, category: 'Selenium', count });
            } else if (val.includes('//')) {
                frameworkSuggestions.push({ type: `By.xpath('${val}')`, category: 'Selenium', count });
            }

            // Cypress
            frameworkSuggestions.push({ type: `cy.get('${val}')`, category: 'Cypress', count });
            if (match.category === 'Text') {
                const text = val.match(/'(.*)'/)?.[1] || val;
                frameworkSuggestions.push({ type: `cy.contains('${text}')`, category: 'Cypress', count });
            }

            // Playwright
            frameworkSuggestions.push({ type: `page.locator('${val}')`, category: 'Playwright', count });
            if (match.category === 'ID') {
                frameworkSuggestions.push({ type: `page.getByTestId('${val.substring(1)}')`, category: 'Playwright', count });
            }
        });

        return [...suggestions, ...frameworkSuggestions]
            .sort((a, b) => {
                // Exact matches first
                const aExact = a.type.toLowerCase() === lowerQuery;
                const bExact = b.type.toLowerCase() === lowerQuery;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            })
            .slice(0, 30);
    }

    _addCategorySuggestions(list, source, category, prefix, query = '', suffix = '') {
        if (!source) return;
        Object.entries(source).forEach(([key, count]) => {
            const fullVal = prefix + key + suffix;
            if (!query || fullVal.toLowerCase().includes(query)) {
                list.push({ type: fullVal, category, count });
            }
        });
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SuggestionManager;
} else {
    window.SuggestionManager = SuggestionManager;
}
