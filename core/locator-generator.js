// Core Locator Generator - Backend Logic
class LocatorGenerator {
    constructor() {
        this.strategies = {
            // Basic locators
            id: (element) => element.id ? `#${element.id}` : null,
            name: (element) => element.name ? `[name='${element.name}']` : null,
            className: (element) => {
                const cleaned = this.cleanClassName(element.className);
                return cleaned ? `.${cleaned.split(' ').join('.')}` : null;
            },
            tagname: (element) => element.tagName.toLowerCase(),
            css: (element) => this.generateCSSSelector(element),
            linkText: (element) => element.tagName === 'A' ? element.textContent.trim() : null,
            partialLinkText: (element) => element.tagName === 'A' ? element.textContent.trim().substring(0, 10) : null,
            absoluteXPath: (element) => this.generateAbsoluteXPath(element),
            jsPath: (element) => `document.querySelector('${this.generateCSSSelector(element)}')`,

            // Relative XPath variants
            xpath: (element) => this.generateRelativeXPath(element),
            containsXpath: (element) => this.generateContainsXPath(element),
            indexedXpath: (element) => this.generateIndexedXPath(element),
            linkTextXpath: (element) => this.generateLinkTextXPath(element),
            partialLinkTextXpath: (element) => this.generatePartialLinkTextXPath(element),
            attributeXpath: (element) => this.generateAttributeXPath(element),
            cssXpath: (element) => this.generateCSSXPath(element)
        };
    }

    cleanClassName(className) {
        if (!className || typeof className !== 'string') return '';
        return className.split(' ')
            .filter(cls => cls !== 'locator-x-highlight' && cls.trim() !== '')
            .map(cls => this.escapeSelector(cls))
            .join('.');
    }

    escapeSelector(str) {
        if (!str) return '';
        // CSS.escape polyfill-ish or standard
        if (typeof CSS !== 'undefined' && CSS.escape) {
            return CSS.escape(str);
        }
        // Basic fallback
        return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }

    generateLocators(element, enabledTypes = []) {
        const locators = [];
        const typeMap = {
            'idLocator': 'id',
            'nameLocator': 'name',
            'classNameLocator': 'className',
            'tagnameLocator': 'tagname',
            'cssLocator': 'css',
            'linkTextLocator': 'linkText',
            'pLinkTextLocator': 'partialLinkText',
            'absoluteLocator': 'absoluteXPath',
            'xpathLocator': 'xpath',
            'containsXpathLocator': 'containsXpath',
            'indexedXpathLocator': 'indexedXpath',
            'LinkTextXpathLocator': 'linkTextXpath',
            'PLinkTextXpathLocator': 'partialLinkTextXpath',
            'attributeXpathLocator': 'attributeXpath',
            'cssXpathLocator': 'cssXpath'
        };

        enabledTypes.forEach(type => {
            const strategy = typeMap[type];
            if (strategy && this.strategies[strategy]) {
                const locator = this.strategies[strategy](element);
                if (locator) {
                    locators.push({
                        type: this.getDisplayName(strategy),
                        locator: locator,
                        matches: this.countMatches(locator, strategy)
                    });
                }
            }
        });

        return locators;
    }

    getDisplayName(strategy) {
        const names = {
            'id': 'ID',
            'name': 'Name',
            'className': 'ClassName',
            'tagname': 'TagName',
            'css': 'CSS',
            'linkText': 'LinkText',
            'partialLinkText': 'Partial LinkText',
            'absoluteXPath': 'Absolute XPath',
            'xpath': 'XPath',
            'containsXpath': 'Contains XPath',
            'indexedXpath': 'Indexed XPath',
            'linkTextXpath': 'Link Text XPath',
            'partialLinkTextXpath': 'Partial Link XPath',
            'attributeXpath': 'Attribute XPath',
            'cssXpath': 'CSS XPath'
        };
        return names[strategy] || strategy;
    }

    generateCSSSelector(element) {
        // 1. ID
        if (element.id) {
            const escapedId = this.escapeSelector(element.id);
            if (this.isUnique(`#${escapedId}`)) return `#${escapedId}`;
        }

        // 2. Attributes (data-testid, etc)
        const attributes = ['data-testid', 'data-test', 'data-cy', 'aria-label', 'name', 'placeholder'];
        for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) {
                const quote = value.includes("'") ? '"' : "'";
                const selector = `[${attr}=${quote}${CSS.escape(value)}${quote}]`;
                if (this.isUnique(selector)) return selector;
                if (element.tagName === 'INPUT' && attr === 'name') { // tag + name often unique enough
                    const tagSelector = `${element.tagName.toLowerCase()}[${attr}=${quote}${CSS.escape(value)}${quote}]`;
                    if (this.isUnique(tagSelector)) return tagSelector;
                }
            }
        }

        // 3. Class (if unique)
        if (element.className) {
            const cleaned = this.cleanClassName(element.className);
            if (cleaned) {
                const selector = `.${cleaned}`;
                if (this.isUnique(selector)) return selector;
                // Try tag + class
                const tagSelector = `${element.tagName.toLowerCase()}.${cleaned}`;
                if (this.isUnique(tagSelector)) return tagSelector;
            }
        }

        // 4. Path generation (Smart Ancestor)
        let path = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();

            // Append ID if present (even if not unique globally, helps locally)
            if (current.id) {
                selector += `#${this.escapeSelector(current.id)}`;
                path.unshift(selector);
                // If this specific ancestor path is unique, stop
                if (this.isUnique(path.join(' > '))) break;
                if (current.id && this.isUnique(`#${this.escapeSelector(current.id)}`)) break; // Should have been caught earlier but good safety
            } else {
                // Sibling index
                let index = 1;
                let sibling = current.previousElementSibling;
                let sameTagSiblings = false;
                while (sibling) {
                    if (sibling.tagName === current.tagName) {
                        index++;
                        sameTagSiblings = true;
                    }
                    sibling = sibling.previousElementSibling;
                }

                // Add class if helpful
                if (current.className) {
                    const cleaned = this.cleanClassName(current.className);
                    if (cleaned) selector += `.${cleaned}`;
                }

                if (sameTagSiblings || index > 1) {
                    selector += `:nth-of-type(${index})`;
                }

                path.unshift(selector);
                if (this.isUnique(path.join(' > '))) break;
            }

            current = current.parentNode;
            if (current && current.tagName === 'BODY') {
                path.unshift('body');
                break;
            }
        }
        return path.join(' > ');
    }

    isUnique(selector) {
        try {
            return document.querySelectorAll(selector).length === 1;
        } catch (e) {
            return false;
        }
    }

    generateAbsoluteXPath(element) {
        let path = '';
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = current.previousSibling;
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            path = `/${current.nodeName.toLowerCase()}[${index}]${path}`;
            current = current.parentNode;
        }
        return path;
    }

    generateRelativeXPath(element) {
        // 1. ID
        if (element.id) {
            const quote = element.id.includes("'") ? '"' : "'";
            return `//*[@id=${quote}${element.id}${quote}]`;
        }

        // 2. Unique Attributes
        const attributes = ['data-testid', 'data-test', 'aria-label', 'placeholder', 'title', 'alt'];
        for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) {
                const quote = value.includes("'") ? '"' : "'";
                return `//*[@${attr}=${quote}${value}${quote}]`;
            }
        }

        // 3. Text content (for buttons, links, labels)
        const tag = element.tagName.toLowerCase();
        if (['a', 'button', 'label', 'h1', 'h2', 'h3', 'span', 'div'].includes(tag)) {
            const text = element.textContent?.trim();
            if (text && text.length > 2 && text.length < 50) {
                const quote = text.includes("'") ? '"' : "'";
                return `//${tag}[normalize-space()=${quote}${text}${quote}]`;
            }
        }

        // 4. Fallback to Tag + Index
        // Note: Full robust XPath generation is complex; this is a simplified improvement
        return `//${tag}`;
    }

    generateContainsXPath(element) {
        const text = element.textContent?.trim();
        if (text && text.length < 50) {
            const escapedText = text.includes("'") ? `"${text}"` : `'${text}'`;
            return `//*[contains(text(),${escapedText})]`;
        }
        if (element.className) {
            const cleaned = this.cleanClassName(element.className);
            if (cleaned) {
                const classPart = cleaned.split(' ')[0];
                const escapedClassPart = classPart.includes("'") ? `"${classPart}"` : `'${classPart}'`;
                return `//*[contains(@class,${escapedClassPart})]`;
            }
        }
        return null;
    }

    generateIndexedXPath(element) {
        let index = 1;
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === element.tagName) index++;
            sibling = sibling.previousElementSibling;
        }
        // Wrapping in parentheses ensures the index applies to the entire set of matches
        return `(${this.generateRelativeXPath(element)})[${index}]`;
    }

    generateLinkTextXPath(element) {
        if (element.tagName === 'A') {
            const text = element.textContent.trim();
            if (!text) return null;
            const quote = text.includes("'") ? '"' : "'";
            return `//a[text()=${quote}${text}${quote}]`;
        }
        return null;
    }

    generatePartialLinkTextXPath(element) {
        if (element.tagName === 'A') {
            const text = element.textContent.trim().substring(0, 10);
            if (!text) return null;
            const quote = text.includes("'") ? '"' : "'";
            return `//a[contains(text(),${quote}${text}${quote})]`;
        }
        return null;
    }

    generateAttributeXPath(element) {
        const attrs = ['data-testid', 'data-test', 'aria-label', 'title', 'alt', 'placeholder'];
        for (const attr of attrs) {
            const value = element.getAttribute(attr);
            if (value) {
                const quote = value.includes("'") ? '"' : "'";
                return `//*[@${attr}=${quote}${value}${quote}]`;
            }
        }
        return null;
    }

    generateCSSXPath(element) {
        const css = this.generateCSSSelector(element);
        return css ? `//*[self::${css.replace(/[#.]/g, '')}]` : null;
    }

    countMatches(selector, strategy) {
        if (!selector) return 0;

        try {
            const lowerStrategy = (strategy || '').toLowerCase();

            // 1. Explicit Strategy Mode (Used by Table Rows)
            if (strategy) {
                if (lowerStrategy.includes('xpath') || lowerStrategy === 'absolutexpath') {
                    return document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
                }
                if (lowerStrategy === 'linktext') {
                    const xpath = selector.includes("'") ? `//a[text()="${selector}"]` : `//a[text()='${selector}']`;
                    return document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
                }
                if (lowerStrategy === 'partiallinktext') {
                    const xpath = selector.includes("'") ? `//a[contains(text(),"${selector}")]` : `//a[contains(text(),'${selector}')]`;
                    return document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
                }
                if (lowerStrategy === 'jspath') {
                    try {
                        const res = eval(selector);
                        return res ? (res.length || 1) : 0;
                    } catch (e) { return 0; }
                }
                return document.querySelectorAll(selector).length;
            }

            // 2. SMART DISCOVERY MODE (Used by Search Bar)
            // Try as CSS first (most common for simple strings)
            let cssCount = 0;
            try {
                cssCount = document.querySelectorAll(selector).length;
            } catch (e) {
                cssCount = 0; // Syntax error for XPath in querySelector
            }

            // Try as XPath if CSS failed or if it looks like XPath
            const looksLikeXpath = selector.startsWith('/') ||
                selector.startsWith('(') ||
                selector.startsWith('.//') ||
                selector.includes('//') ||
                selector.includes('text()') ||
                selector.includes('@');

            if (cssCount === 0 || looksLikeXpath) {
                try {
                    const xpathResult = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    const xpathCount = xpathResult.snapshotLength;

                    // If both matched something, return the higher count (or combine if needed, but usually it's one or the other)
                    return Math.max(cssCount, xpathCount);
                } catch (e) {
                    return cssCount; // Fallback to whatever CSS found
                }
            }

            return cssCount;
        } catch (e) {
            return 0;
        }
    }

    getDisplayName(strategy) {
        const names = {
            id: 'ID',
            name: 'Name',
            className: 'Class Name',
            css: 'CSS Selector',
            xpath: 'Relative XPath',
            containsXpath: 'Contains XPath',
            indexedXpath: 'Indexed XPath',
            linkTextXpath: 'Link Text XPath',
            partialLinkTextXpath: 'Partial Link XPath',
            attributeXpath: 'Attribute XPath',
            cssXpath: 'CSS XPath',
            absoluteXPath: 'Absolute XPath',
            jsPath: 'JS Path'
        };
        return names[strategy] || strategy;
    }
    generateFingerprint(element) {
        return {
            tag: element.tagName.toLowerCase(),
            id: element.id || '',
            name: element.name || '',
            className: this.cleanClassName(element.className),
            type: element.getAttribute('type') || '',
            role: element.getAttribute('role') || '',
            placeholder: element.getAttribute('placeholder') || '',
            text: (element.textContent || '').substring(0, 50).trim(),
            href: element.getAttribute('href') || '',
            alt: element.getAttribute('alt') || '',
            title: element.getAttribute('title') || '',
            parentTag: element.parentElement ? element.parentElement.tagName.toLowerCase() : '',
            parentId: element.parentElement ? (element.parentElement.id || '') : '',
            parentClass: element.parentElement ? this.cleanClassName(element.parentElement.className) : '',
            prevSiblingTag: element.previousElementSibling ? element.previousElementSibling.tagName.toLowerCase() : '',
            attributes: this.getImportantAttributes(element)
        };
    }

    getImportantAttributes(element) {
        const important = ['data-testid', 'data-test', 'data-cy', 'aria-label'];
        const attrs = {};
        important.forEach(attr => {
            const val = element.getAttribute(attr);
            if (val) attrs[attr] = val;
        });
        return attrs;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorGenerator;
} else {
    window.LocatorGenerator = LocatorGenerator;
}