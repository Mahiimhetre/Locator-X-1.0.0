class MultiScanManager {
    constructor() {
        // No state needed really, mostly pure functions, but good for grouping
    }

    getCommonPatterns(framework) {
        const patterns = {
            'selenium-java': {
                find: [
                    { label: 'Standard: driver.findElement(By.{type}("{locator}"))', regex: 'driver\\.findElements?\\(By\\.{type}\\("{locator}"\\)\\)' },
                    { label: 'Annotation: @FindBy({type}="{locator}")', regex: '@FindBy\\({type}\\s*=\\s*"{locator}"\\)' },
                    { label: 'Annotation Regex: @FindBy({type}="{locator}")', regex: '@FindBy\\(\\{type\\}\\s*=\\s*"{locator}"\\)' }
                ],
                wait: [
                    { label: 'Explicit Wait', regex: 'WebDriverWait\\(driver.*\\)\\.until\\(ExpectedConditions\\..*By\\.{type}\\("{locator}"\\)\\)' }
                ],
                assert: [
                    { label: 'Assert Visible', regex: 'assertTrue\\(driver\\.findElement\\(By\\.{type}\\("{locator}"\\)\\)\\.isDisplayed\\(\\)\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'driver\\.findElement\\(By\\.{type}\\("{locator}"\\)\\)\\.click\\(\\)' },
                    { label: 'SendKeys', regex: 'driver\\.findElement\\(By\\.{type}\\("{locator}"\\)\\)\\.sendKeys\\(".*"\\)' }
                ]
            },
            'selenium-python': {
                find: [
                    { label: 'Standard: driver.find_element(By.{type}, "{locator}")', regex: 'driver\\.find_elements?\\(By\\.{type},\\s*"{locator}"\\)' }
                ],
                wait: [
                    { label: 'Explicit Wait', regex: 'WebDriverWait\\(driver.*\\)\\.until\\(EC\\..*\\(By\\.{type},\\s*"{locator}"\\)\\)' }
                ],
                assert: [
                    { label: 'Assert Visible', regex: 'assert driver\\.find_element\\(By\\.{type},\\s*"{locator}"\\)\\.is_displayed\\(\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'driver\\.find_element\\(By\\.{type},\\s*"{locator}"\\)\\.click\\(\\)' },
                    { label: 'SendKeys', regex: 'driver\\.find_element\\(By\\.{type},\\s*"{locator}"\\)\\.send_keys\\(".*"\\)' }
                ]
            },
            'selenium-js': {
                find: [
                    { label: 'Standard: await driver.findElement(By.{type}("{locator}"))', regex: 'await driver\\.findElements?\\(By\\.{type}\\("{locator}"\\)\\)' }
                ],
                wait: [
                    { label: 'Explicit Wait', regex: 'await driver\\.wait\\(until\\..*By\\.{type}\\("{locator}"\\)\\)' }
                ],
                assert: [
                    { label: 'Assert Visible', regex: 'assert\\(await driver\\.findElement\\(By\\.{type}\\("{locator}"\\)\\)\\.isDisplayed\\(\\)\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'await driver\\.findElement\\(By\\.{type}\\("{locator}"\\)\\)\\.click\\(\\)' },
                    { label: 'SendKeys', regex: 'await driver\\.findElement\\(By\\.{type}\\("{locator}"\\)\\)\\.sendKeys\\(".*"\\)' }
                ]
            },
            'playwright-js': {
                find: [
                    { label: 'Locator: page.locator("{type}={locator}")', regex: 'page\\.locator\\("{type}={locator}"\\)' },
                    { label: 'Async Locator: await page.{type}("{locator}")', regex: 'await page\\.{type}\\("{locator}"\\)' }
                ],
                wait: [
                    { label: 'Wait Visible', regex: 'await expect\\(page\\.locator\\(".*"\\)\\)\\.toBeVisible\\(\\)' }
                ],
                assert: [
                    { label: 'Assert Text', regex: 'await expect\\(page\\.locator\\(".*"\\)\\)\\.toHaveText\\(".*"\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'await page\\.click\\(".*"\\)' },
                    { label: 'Fill', regex: 'await page\\.fill\\(".*", ".*"\\)' }
                ]
            },
            'playwright-python': {
                find: [
                    { label: 'Locator: page.locator("{type}={locator}")', regex: 'page\\.locator\\("{type}={locator}"\\)' },
                    { label: 'Sync Locator: page.{type}("{locator}")', regex: 'page\\.{type}\\("{locator}"\\)' }
                ],
                wait: [
                    { label: 'Wait Visible', regex: 'expect\\(page\\.locator\\(".*"\\)\\)\\.to_be_visible\\(\\)' }
                ],
                assert: [
                    { label: 'Assert Text', regex: 'expect\\(page\\.locator\\(".*"\\)\\)\\.to_have_text\\(".*"\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'page\\.click\\(".*"\\)' },
                    { label: 'Fill', regex: 'page\\.fill\\(".*", ".*"\\)' }
                ]
            },
            'playwright-java': {
                find: [
                    { label: 'Standard: page.{type}("{locator}")', regex: 'page\\.{type}\\("{locator}"\\)' },
                    { label: 'Locator: page.locator("{type}={locator}")', regex: 'page\\.locator\\("{type}={locator}"\\)' }
                ],
                wait: [
                    { label: 'Wait Visible', regex: 'assertThat\\(page\\.locator\\(".*"\\)\\)\\.isVisible\\(\\)' }
                ],
                assert: [
                    { label: 'Assert Text', regex: 'assertThat\\(page\\.locator\\(".*"\\)\\)\\.hasText\\(".*"\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'page\\.locator\\(".*"\\)\\.click\\(\\)' },
                    { label: 'Fill', regex: 'page\\.locator\\(".*"\\)\\.fill\\(".*"\\)' }
                ]
            },
            'cypress': {
                find: [
                    { label: 'Standard: cy.{type}("{locator}")', regex: 'cy\\.{type}\\("{locator}"\\)' }
                ],
                wait: [
                    { label: 'Should Visible', regex: 'cy\\.get\\(".*"\\)\\.should\\("be\\.visible"\\)' }
                ],
                assert: [
                    { label: 'Should Have Text', regex: 'cy\\.get\\(".*"\\)\\.should\\("have\\.text", ".*"\\)' }
                ],
                interact: [
                    { label: 'Click', regex: 'cy\\.get\\(".*"\\)\\.click\\(\\)' },
                    { label: 'Type', regex: 'cy\\.get\\(".*"\\)\\.type\\(".*"\\)' }
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
            p.regex.toLowerCase().includes(query)
        );
    }

    convertSmartPatternToRegex(patternInput) {
        if (!patternInput) {
            // Default fallback
            return '(id|name|class|data-test-id)="([^"]+)"';
        }

        if (patternInput.includes('{locator}') || patternInput.includes('{type}')) {
            // 1. Temporarily replace placeholders
            let safePattern = patternInput
                .replace('{type}', '___TYPE_PLACEHOLDER___')
                .replace('{locator}', '___LOCATOR_PLACEHOLDER___');

            // 2. Escape valid regex characters if it looks like a plain string
            if (!patternInput.includes('\\')) {
                safePattern = safePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            // 3. Restore placeholders as Regex Capture Groups
            return safePattern
                .replace('___TYPE_PLACEHOLDER___', '([a-zA-Z0-9_]+)')
                .replace('___LOCATOR_PLACEHOLDER___', '([^"]+)');
        }

        // Assume Raw Regex
        return patternInput;
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
}

// Expose to window for Panel Context
if (typeof window !== 'undefined') {
    window.MultiScanManager = MultiScanManager;
}
