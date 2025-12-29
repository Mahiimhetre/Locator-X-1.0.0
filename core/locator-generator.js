// Core Locator Generator - Backend Logic
class LocatorGenerator {
    constructor() {
        this.strategies = {
            // Basic locators
            id: (element) => element.id ? `#${element.id}` : null,
            name: (element) => element.name ? `[name="${element.name}"]` : null,
            className: (element) => {
                const cleaned = this.cleanClassName(element.className);
                return cleaned ? `.${cleaned.split(' ').join('.')}` : null;
            },
            tagname: (element) => element.tagName.toLowerCase(),
            css: (element) => this.generateCSSSelector(element),
            linkText: (element) => element.tagName === 'A' ? element.textContent.trim() : null,
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
                const selector = `[${attr}="${CSS.escape(value)}"]`;
                if (this.isUnique(selector)) return selector;
                if (element.tagName === 'INPUT' && attr === 'name') { // tag + name often unique enough
                    const tagSelector = `${element.tagName.toLowerCase()}[${attr}="${CSS.escape(value)}"]`;
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
        if (element.id) return `//*[@id="${element.id}"]`;

        // 2. Unique Attributes
        const attributes = ['data-testid', 'data-test', 'aria-label', 'placeholder', 'title', 'alt'];
        for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) return `//*[@${attr}="${value}"]`;
        }

        // 3. Text content (for buttons, links, labels)
        const tag = element.tagName.toLowerCase();
        if (['a', 'button', 'label', 'h1', 'h2', 'h3', 'span', 'div'].includes(tag)) {
            const text = element.textContent?.trim();
            if (text && text.length > 2 && text.length < 50) {
                // Check if text is unique enough (simple check)
                return `//${tag}[normalize-space()="${text}"]`;
            }
        }

        // 4. Fallback to Tag + Index
        // Note: Full robust XPath generation is complex; this is a simplified improvement
        return `//${tag}`;
    }

    generateContainsXPath(element) {
        const text = element.textContent?.trim();
        if (text && text.length < 50) {
            return `//*[contains(text(),"${text}")]`;
        }
        if (element.className) {
            const cleaned = this.cleanClassName(element.className);
            if (cleaned) {
                return `//*[contains(@class,"${cleaned.split(' ')[0]}")]`;
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
        return `//${element.tagName.toLowerCase()}[${index}]`;
    }

    generateLinkTextXPath(element) {
        if (element.tagName === 'A') {
            const text = element.textContent.trim();
            return text ? `//a[text()="${text}"]` : null;
        }
        return null;
    }

    generatePartialLinkTextXPath(element) {
        if (element.tagName === 'A') {
            const text = element.textContent.trim();
            return text ? `//a[contains(text(),"${text}")]` : null;
        }
        return null;
    }

    generateAttributeXPath(element) {
        const attrs = ['data-testid', 'data-test', 'aria-label', 'title', 'alt', 'placeholder'];
        for (const attr of attrs) {
            const value = element.getAttribute(attr);
            if (value) {
                return `//*[@${attr}="${value}"]`;
            }
        }
        return null;
    }

    generateCSSXPath(element) {
        const css = this.generateCSSSelector(element);
        return css ? `//*[self::${css.replace(/[#.]/g, '')}]` : null;
    }

    countMatches(selector, strategy) {
        try {
            if (strategy?.includes('xpath') || strategy === 'absoluteXPath') {
                return document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
            }
            return document.querySelectorAll(selector).length;
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
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorGenerator;
} else {
    window.LocatorGenerator = LocatorGenerator;
}