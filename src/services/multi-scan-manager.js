class MultiScanManager {
    constructor() {
        // No state needed really, mostly pure functions, but good for grouping
    }

    getCommonPatterns(framework) {
        const patterns = {
            'selenium-java': {
                find: [
                    { label: 'Standard', template: 'driver.findElement(By.{type}("{locator}"))' },
                    { label: 'Elements (Plural)', template: 'driver.findElements(By.{type}("{locator}"))' },
                    { label: 'Annotation', template: '@FindBy({type}="{locator}")' }
                ],
                wait: [
                    { label: 'Explicit Wait', template: 'ExpectedConditions.{type}("{locator}")' }
                ],
                assert: [
                    { label: 'Assert True', template: 'assertTrue(driver.findElement(By.{type}("{locator}")))' }
                ]
            },
            'selenium-python': {
                find: [
                    { label: 'Standard', template: 'driver.find_element(By.{type}, "{locator}")' },
                    { label: 'Elements (Plural)', template: 'driver.find_elements(By.{type}, "{locator}")' }
                ]
            },
            'selenium-js': {
                find: [
                    { label: 'Standard', template: 'await driver.findElement(By.{type}("{locator}"))' }
                ]
            },
            'playwright-js': {
                find: [
                    { label: 'Locator', template: 'page.locator("{type}={locator}")' },
                    { label: 'Role/Label', template: 'page.getBy{type}("{locator}")' },
                    { label: 'Async Type', template: 'await page.{type}("{locator}")' }
                ],
                interact: [
                    { label: 'Click', template: 'await page.click("{locator}")' }, // Simple case
                    { label: 'Fill', template: 'await page.fill("{locator}", "value")' }
                ]
            },
            'playwright-python': {
                find: [
                    { label: 'Locator', template: 'page.locator("{type}={locator}")' },
                    { label: 'Sync Type', template: 'page.{type}("{locator}")' }
                ]
            },
            'playwright-java': {
                find: [
                    { label: 'Locator', template: 'page.locator("{type}={locator}")' },
                    { label: 'Standard', template: 'page.{type}("{locator}")' }
                ]
            },
            'cypress': {
                find: [
                    { label: 'Standard', template: 'cy.{type}("{locator}")' }, // Covers cy.get, cy.contains
                    { label: 'Find', template: 'cy.get("{locator}")' }
                ]
            }
        };
        if (framework === 'all') return patterns;
        return patterns[framework] || patterns['selenium-java'];
    }

    filterPatterns(query, framework) {
        query = query.trim().toLowerCase();
        const categories = this.getCommonPatterns(framework);
        let patterns = [];

        if (framework === 'all') {
            Object.values(categories).forEach(frameworkObj => {
                if (frameworkObj && frameworkObj.find) {
                    patterns = patterns.concat(frameworkObj.find);
                }
            });
        } else {
            if (categories.find) {
                patterns = categories.find;
            } else if (Array.isArray(categories)) {
                patterns = categories;
            }
        }

        return patterns.filter(p =>
            p.label.toLowerCase().includes(query) ||
            p.template.toLowerCase().includes(query)
        );
    }

    convertSmartPatternToRegex(patternInput) {
        if (!patternInput) {
            // Default regex fallback if empty
            return '(id|name|class|data-test-id)="([^"]+)"';
        }

        // 1. Escape special characters to treat input as literal text first
        let safePattern = patternInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 2. Restore placeholders ({type}, {locator}) -> Regex Groups
        // We escaped the {} so we need to look for \{type\} etc
        if (safePattern.includes('\\{type\\}')) {
            safePattern = safePattern.replace('\\{type\\}', '([a-zA-Z0-9_.]+)');
        }
        if (safePattern.includes('\\{locator\\}')) {
            // Locator is tricky, it might contain quotes.
            // If the original template had quotes around {locator}, they are now escaped \"
            safePattern = safePattern.replace('\\{locator\\}', '([^"]+)');
        }

        return safePattern;
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('No file provided'));
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    findMatches(text, pattern, isCustom, smartInputVal) {
        const regex = new RegExp(pattern, 'g');
        const matches = [...text.matchAll(regex)];

        if (matches.length === 0) return [];

        return matches.map((match, index) => {
            let type = 'Custom';
            let locator = match[0]; // Fallback to full match

            if (!isCustom) {
                // Default built-in regex logic
                if (match.length >= 3) {
                    type = match[1];
                    locator = match[2];
                }
            } else {
                // Smart / Custom Pattern logic
                const hasType = smartInputVal.includes('{type}');
                const hasLocator = smartInputVal.includes('{locator}');

                if (hasType && hasLocator) {
                    if (match.length >= 3) {
                        type = match[1];
                        locator = match[2];
                    }
                } else if (hasLocator && !hasType) {
                    if (match.length >= 2) locator = match[1];
                    type = 'Smart Match';
                }

                // Cleanup types
                if (type === 'Smart Match' || type === 'Custom' || type.startsWith('By.')) {
                    if (smartInputVal.includes('By.id') || match[0].includes('By.id')) type = 'ID';
                    else if (smartInputVal.includes('By.name') || match[0].includes('By.name')) type = 'Name';
                    else if (smartInputVal.includes('By.xpath') || match[0].includes('By.xpath')) type = 'XPath';
                    else if (smartInputVal.includes('By.className') || match[0].includes('By.className')) type = 'ClassName';
                    else if (smartInputVal.includes('cy.get')) type = 'Cypress';

                    // NEW: Infer from locator string if still generic
                    if (type === 'Smart Match' && locator) {
                        if (locator.startsWith('/') || locator.startsWith('(')) type = 'xpath';
                        else if (locator.startsWith('#')) type = 'id';
                        else if (locator.startsWith('.')) type = 'className';
                        else if (locator.includes('[')) type = 'css';
                        else type = 'xpath'; // Default assumption for unclassified strings that might be complex XPaths
                    }
                }
            }

            return { index, type, locator };
        });
    }

    autoScan(text, framework) {
        const patternsObj = this.getCommonPatterns(framework);
        let allPatterns = [];

        // Recursive flattening of patterns (handles framework-specific or 'all' framework structure)
        const flatten = (obj) => {
            if (Array.isArray(obj)) {
                allPatterns = allPatterns.concat(obj);
            } else if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(val => flatten(val));
            }
        };

        if (patternsObj) flatten(patternsObj);

        let allMatches = [];
        const uniqueLocators = new Set();

        allPatterns.forEach(p => {
            // Convert to regex if needed
            try {
                // If template exists, convert it. If regex exists (legacy/fallback), use it.
                const patternStr = p.template || p.regex;
                const compiledRegex = this.convertSmartPatternToRegex(patternStr);
                let matches = this.findMatches(text, compiledRegex, false, '');

                matches.forEach(m => {
                    const key = `${m.type}:${m.locator}`;
                    if (!uniqueLocators.has(key)) {
                        uniqueLocators.add(key);
                        // Re-index locally later
                        allMatches.push(m);
                    }
                });
            } catch (e) {
                console.warn('Regex error for pattern:', p.label, e);
            }
        });

        // Re-index
        return allMatches.map((m, i) => ({ ...m, index: i }));
    }
}

// Expose to window for Panel Context
if (typeof window !== 'undefined') {
    window.MultiScanManager = MultiScanManager;
}
