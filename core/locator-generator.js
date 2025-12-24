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
        if (!className) return '';
        if (typeof className !== 'string') return '';
        return className.split(' ')
            .filter(cls => cls !== 'locator-x-highlight' && cls.trim() !== '')
            .join(' ');
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
        if (element.id) return `#${element.id}`;
        if (element.className) {
            const cleaned = this.cleanClassName(element.className);
            if (cleaned) return `.${cleaned.split(' ').join('.')}`;
        }

        let path = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.nodeName.toLowerCase();
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            }
            path.unshift(selector);
            current = current.parentNode;
        }
        return path.join(' > ');
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
        if (element.id) return `//*[@id="${element.id}"]`;
        if (element.className) {
            const cleaned = this.cleanClassName(element.className);
            if (cleaned) return `//*[@class="${cleaned}"]`;
        }
        return `//${element.tagName.toLowerCase()}`;
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