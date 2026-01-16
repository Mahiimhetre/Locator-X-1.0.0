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
            // Axes XPath
            axes: (anchor, target) => this.generateAxesXPath(anchor, target)
        };
    }

    generateAxesXPath(anchor, target) {
        if (!anchor || !target) return null;

        // 1. Determine relationship
        let relationship = '';
        let axis = '';

        if (anchor === target) return 'self::*';

        // Check for Ancestor/Descendant
        if (anchor.contains(target)) {
            relationship = 'descendant';
            axis = 'descendant';
        } else if (target.contains(anchor)) {
            relationship = 'ancestor';
            axis = 'ancestor';
        } else {
            // Check for Siblings or General Preceding/Following
            // Use compareDocumentPosition bitmask
            const comparison = anchor.compareDocumentPosition(target);

            if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
                // Target is after Anchor
                if (anchor.parentNode === target.parentNode) {
                    axis = 'following-sibling';
                } else {
                    axis = 'following';
                }
            } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
                // Target is before Anchor
                if (anchor.parentNode === target.parentNode) {
                    axis = 'preceding-sibling';
                } else {
                    axis = 'preceding';
                }
            }
        }

        if (!axis) return null;

        // Generate Anchor XPath (Relative or ID-based)
        const anchorXpath = this.generateRelativeXPath(anchor);

        // Generate Target Selector relative to axis
        // We want something like: //anchor/axis::target

        const targetTag = target.tagName.toLowerCase();
        let targetPredicate = '';

        // Try to identify target uniquely within that axis if possible
        // For simplicity, we'll try ID, then Text, then Class, then Index

        if (target.id) {
            const quote = target.id.includes("'") ? '"' : "'";
            targetPredicate = `[@id=${quote}${target.id}${quote}]`;
        } else {
            // Text Match
            const text = target.textContent?.trim();
            if (text && text.length > 0 && text.length < 50) {
                const quote = text.includes("'") ? '"' : "'";
                targetPredicate = `[normalize-space()=${quote}${text}${quote}]`;
            } else if (target.className) {
                const cleaned = this.cleanClassName(target.className).split('.')[0];
                if (cleaned) {
                    const quote = cleaned.includes("'") ? '"' : "'";
                    targetPredicate = `[contains(@class, ${quote}${cleaned}${quote})]`;
                }
            }
        }

        // If no specific predicate, maybe use index? 
        // Indexing relative to axis can be tricky.

        const xpath = `${anchorXpath}/${axis}::${targetTag}${targetPredicate}`;
        return xpath;
    }

    isExtensionElement(element) {
        if (!element || !element.classList) return false;
        const config = (typeof LocatorXConfig !== 'undefined') ? LocatorXConfig : null;
        if (!config) return false;

        const ids = config.IDENTIFIERS;
        return element.classList.contains(ids.OVERLAY_CLASS) ||
            element.classList.contains(ids.MATCH_OVERLAY_CLASS) ||
            element.classList.contains(ids.HIGHLIGHT_CLASS) ||
            (element.id && element.id.toLowerCase().startsWith(ids.ID_PREFIX.toLowerCase()));
    }

    cleanClassName(className) {
        if (!className || typeof className !== 'string') return '';
        const highlightClass = (typeof LocatorXConfig !== 'undefined') ?
            LocatorXConfig.IDENTIFIERS.HIGHLIGHT_CLASS : 'locator-x-highlight';

        return className.split(' ')
            .filter(cls => cls !== highlightClass && cls.trim() !== '')
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
        if (this.isExtensionElement(element)) return [];
        console.log('[Locator-X] Starting generateLocators for element:', element);
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
                try {
                    console.log(`[Locator-X] Executing strategy: ${strategy}`);
                    const locator = this.strategies[strategy](element);
                    if (locator) {
                        console.log(`[Locator-X] Strategy ${strategy} SUCCESS: ${locator}`);
                        locators.push({
                            type: this.getDisplayName(strategy),
                            locator: locator,
                            matches: this.countMatches(locator, strategy)
                        });
                    } else {
                        console.log(`[Locator-X] Strategy ${strategy} returned NULL`);
                    }
                } catch (error) {
                    console.error(`[Locator-X] Strategy ${strategy} FAILED:`, error);
                }
            }
        });

        console.log('[Locator-X] generateLocators completed. Result:', locators);
        return locators;
    }

    getDisplayName(strategy) {
        return LocatorXConfig.STRATEGY_NAMES[strategy] || strategy;
    }

    generateCSSSelector(element) {
        console.log('[Locator-X] generateCSSSelector input:', element);
        // 1. ID
        if (element.id) {
            const escapedId = this.escapeSelector(element.id);
            if (this.isUnique(`#${escapedId}`)) {
                const res = `#${escapedId}`;
                console.log('[Locator-X] generateCSSSelector result (ID):', res);
                return res;
            }
        }

        // 2. Attributes (data-testid, etc)
        const attributes = LocatorXConfig.IMPORTANT_ATTRIBUTES;
        for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) {
                const quote = value.includes("'") ? '"' : "'";
                const selector = `[${attr}=${quote}${CSS.escape(value)}${quote}]`;
                if (this.isUnique(selector)) {
                    console.log('[Locator-X] generateCSSSelector result (Attr):', selector);
                    return selector;
                }
                if (element.tagName === 'INPUT' && attr === 'name') {
                    const tagSelector = `${element.tagName.toLowerCase()}[${attr}=${quote}${CSS.escape(value)}${quote}]`;
                    if (this.isUnique(tagSelector)) {
                        console.log('[Locator-X] generateCSSSelector result (Tag+Name):', tagSelector);
                        return tagSelector;
                    }
                }
            }
        }

        // 3. Class (if unique)
        if (element.className) {
            const cleaned = this.cleanClassName(element.className);
            if (cleaned) {
                const selector = `.${cleaned}`;
                if (this.isUnique(selector)) {
                    console.log('[Locator-X] generateCSSSelector result (Class):', selector);
                    return selector;
                }
                // Try tag + class
                const tagSelector = `${element.tagName.toLowerCase()}.${cleaned}`;
                if (this.isUnique(tagSelector)) {
                    console.log('[Locator-X] generateCSSSelector result (Tag+Class):', tagSelector);
                    return tagSelector;
                }
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
                if (current.id && this.isUnique(`#${this.escapeSelector(current.id)}`)) break;
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

            current = current.parentNode || (current.getRootNode && current.getRootNode().host);
            if (current && current.tagName === 'BODY') {
                path.unshift('body');
                break;
            }
        }
        const finalPath = path.join(' > ');
        console.log('[Locator-X] generateCSSSelector result (Path):', finalPath);
        return finalPath;
    }

    isUnique(selector) {
        try {
            return this.countMatches(selector) === 1;
        } catch (e) {
            return false;
        }
    }

    generateAbsoluteXPath(element) {
        console.log('[Locator-X] generateAbsoluteXPath input:', element);
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
        console.log('[Locator-X] generateAbsoluteXPath result:', path);
        return path;
    }

    generateRelativeXPath(element) {
        console.log('[Locator-X] generateRelativeXPath input:', element);
        // 1. ID
        if (element.id) {
            const quote = element.id.includes("'") ? '"' : "'";
            const res = `//*[@id=${quote}${element.id}${quote}]`;
            console.log('[Locator-X] generateRelativeXPath result (ID):', res);
            return res;
        }

        // 2. Unique Attributes
        const attributes = LocatorXConfig.IMPORTANT_ATTRIBUTES;
        for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) {
                const quote = value.includes("'") ? '"' : "'";
                const res = `//*[@${attr}=${quote}${value}${quote}]`;
                console.log('[Locator-X] generateRelativeXPath result (Attr):', res);
                return res;
            }
        }

        // 3. Text content (for buttons, links, labels)
        const tag = element.tagName.toLowerCase();
        if (LocatorXConfig.TAG_GROUPS.TEXT_CONTAINERS.includes(tag)) {
            const text = element.textContent?.trim();
            if (text && text.length > LocatorXConfig.LIMITS.TEXT_MATCH_MIN && text.length < LocatorXConfig.LIMITS.TEXT_MATCH_MAX) {
                const quote = text.includes("'") ? '"' : "'";
                const res = `//${tag}[normalize-space()=${quote}${text}${quote}]`;
                console.log('[Locator-X] generateRelativeXPath result (Text):', res);
                return res;
            }
        }

        // 4. Fallback to Tag + Index
        const res = `//${tag}`;
        console.log('[Locator-X] generateRelativeXPath result (Fallback):', res);
        return res;
    }

    generateContainsXPath(element) {
        console.log('[Locator-X] generateContainsXPath input:', element);
        const text = element.textContent?.trim();
        if (text && text.length < 50) {
            const escapedText = text.includes("'") ? `"${text}"` : `'${text}'`;
            const res = `//*[contains(text(),${escapedText})]`;
            console.log('[Locator-X] generateContainsXPath result (Text):', res);
            return res;
        }
        // Improved: Check attributes (id, class, etc.)
        const attrs = ['id', 'class', 'name', 'title', 'placeholder', 'role', 'aria-label'];
        for (const attr of attrs) {
            const val = element.getAttribute(attr);
            if (val) {
                if (attr === 'class') {
                    const classPart = this.cleanClassName(val).split(' ')[0];
                    if (classPart) {
                        const quote = classPart.includes("'") ? '"' : "'";
                        const res = `//*[contains(@class,${quote}${classPart}${quote})]`;
                        console.log('[Locator-X] generateContainsXPath result (Class):', res);
                        return res;
                    }
                } else {
                    const quote = val.includes("'") ? '"' : "'";
                    const res = `//*[contains(@${attr},${quote}${val}${quote})]`;
                    console.log('[Locator-X] generateContainsXPath result (Attr):', res);
                    return res;
                }
            }
        }
        console.log('[Locator-X] generateContainsXPath result: NULL');
        return null;
    }

    generateIndexedXPath(element) {
        console.log('[Locator-X] generateIndexedXPath input:', element);
        let index = 1;
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === element.tagName) index++;
            sibling = sibling.previousElementSibling;
        }
        const rel = this.generateRelativeXPath(element);
        const res = `(${rel})[${index}]`;
        console.log('[Locator-X] generateIndexedXPath result:', res);
        return res;
    }

    generateLinkTextXPath(element) {
        console.log('[Locator-X] generateLinkTextXPath input:', element);
        if (element.tagName === 'A') {
            const text = element.textContent.trim();
            if (!text) {
                console.log('[Locator-X] generateLinkTextXPath result: NULL (No text)');
                return null;
            }
            const quote = text.includes("'") ? '"' : "'";
            const res = `//a[text()=${quote}${text}${quote}]`;
            console.log('[Locator-X] generateLinkTextXPath result:', res);
            return res;
        }
        console.log('[Locator-X] generateLinkTextXPath result: NULL (Not A tag)');
        return null;
    }

    generatePartialLinkTextXPath(element) {
        console.log('[Locator-X] generatePartialLinkTextXPath input:', element);
        if (element.tagName === 'A') {
            const text = element.textContent.trim().substring(0, 10);
            if (!text) {
                console.log('[Locator-X] generatePartialLinkTextXPath result: NULL (No text)');
                return null;
            }
            const quote = text.includes("'") ? '"' : "'";
            const res = `//a[contains(text(),${quote}${text}${quote})]`;
            console.log('[Locator-X] generatePartialLinkTextXPath result:', res);
            return res;
        }
        console.log('[Locator-X] generatePartialLinkTextXPath result: NULL (Not A tag)');
        return null;
    }

    generateAttributeXPath(element) {
        console.log('[Locator-X] generateAttributeXPath input:', element);
        // Explicitly check ID first
        if (element.id) {
            const quote = element.id.includes("'") ? '"' : "'";
            const res = `//*[@id=${quote}${element.id}${quote}]`;
            console.log('[Locator-X] generateAttributeXPath result (ID):', res);
            return res;
        }

        const attrs = LocatorXConfig.IMPORTANT_ATTRIBUTES;
        for (const attr of attrs) {
            const value = element.getAttribute(attr);
            if (value) {
                const quote = value.includes("'") ? '"' : "'";
                const res = `//*[@${attr}=${quote}${value}${quote}]`;
                console.log('[Locator-X] generateAttributeXPath result (Attr):', res);
                return res;
            }
        }
        console.log('[Locator-X] generateAttributeXPath result: NULL');
        return null;
    }

    generateCSSXPath(element) {
        console.log('[Locator-X] generateCSSXPath input:', element);
        const css = this.generateCSSSelector(element);
        const res = css ? `//*[self::${css.replace(/[#.]/g, '')}]` : null;
        console.log('[Locator-X] generateCSSXPath result:', res);
        return res;
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


    countMatches(selector, strategy) {
        if (!selector) return 0;

        try {
            const lowerStrategy = (strategy || '').toLowerCase();

            // 1. Explicit Strategy Mode
            if (strategy) {
                if (lowerStrategy.includes('xpath') || lowerStrategy === 'absolutexpath') {
                    try {
                        return this.evaluateXPathDeep(selector).length;
                    } catch (e) { return 0; }
                }
                if (lowerStrategy === 'linktext') {
                    const xpath = selector.includes("'") ? `//a[text()="${selector}"]` : `//a[text()='${selector}']`;
                    return this.evaluateXPathDeep(xpath).length;
                }
                if (lowerStrategy === 'partiallinktext') {
                    const xpath = selector.includes("'") ? `//a[contains(text(),"${selector}")]` : `//a[contains(text(),'${selector}')]`;
                    return this.evaluateXPathDeep(xpath).length;
                }
                if (lowerStrategy === 'jspath') {
                    try {
                        const res = eval(selector);
                        return res ? (res.length || 1) : 0;
                    } catch (e) { return 0; }
                }
                return this.querySelectorAllDeep(selector).length;
            }

            // 2. SMART DISCOVERY MODE (Used by Search Bar)
            // Try CSS first
            let cssMatches = [];
            let cssError = false;

            const looksLikeXpath = selector.startsWith('/') ||
                selector.startsWith('(') ||
                selector.startsWith('.//') ||
                selector.includes('//') ||
                selector.includes('text()') ||
                selector.includes('@');

            if (!looksLikeXpath) {
                try {
                    cssMatches = this.querySelectorAllDeep(selector);
                } catch (e) {
                    cssError = true;
                }
            }

            // Try XPath if CSS failed or looks like XPath
            let xpathMatches = [];
            if (cssMatches.length === 0 || cssError || looksLikeXpath) {
                try {
                    xpathMatches = this.evaluateXPathDeep(selector);
                } catch (e) { }
            }

            // Text search fallback (DevTools style)
            let textCount = 0;
            if (cssMatches.length === 0 && xpathMatches.length === 0 && selector.length > 2) {
                textCount = this.countTextMatches(selector);
            }

            return Math.max(cssMatches.length, xpathMatches.length, textCount);
        } catch (e) {
            return 0;
        }
    }

    countTextMatches(query) {
        const lowerQuery = query.toLowerCase();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (this.isExtensionElement(node.parentElement)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }, false);
        let count = 0;
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(lowerQuery)) {
                count++;
            }
        }
        return count;
    }

    // Evaluate XPath across Shadow boundaries (by recursing evaluate)
    evaluateXPathDeep(xpath, root = document, results = []) {
        if (root.host && this.isExtensionElement(root.host)) return results;
        try {
            const res = document.evaluate(xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < res.snapshotLength; i++) {
                const item = res.snapshotItem(i);
                if (!this.isExtensionElement(item)) {
                    results.push(item);
                }
            }
        } catch (e) { }

        // Recurse into Shadow DOM (XPath doesn't natively cross boundaries)
        const all = root.querySelectorAll('*');
        for (const el of all) {
            if (el.shadowRoot) {
                this.evaluateXPathDeep(xpath, el.shadowRoot, results);
            }
        }
        return results;
    }

    // Helper to find all elements across Shadow boundaries
    querySelectorAllDeep(selector, root = document, results = []) {
        if (root.host && this.isExtensionElement(root.host)) return results;
        try {
            const matches = root.querySelectorAll(selector);
            matches.forEach(m => {
                if (!this.isExtensionElement(m)) {
                    results.push(m);
                }
            });
        } catch (e) {
            if (e.name === 'SyntaxError') throw e;
        }

        // Search in Shadow Roots only (to avoid double-counting light DOM)
        const all = root.querySelectorAll('*');
        for (const el of all) {
            if (el.shadowRoot) {
                this.querySelectorAllDeep(selector, el.shadowRoot, results);
            }
        }
        return results;
    }

    // Helper to find first match across Shadow boundaries
    querySelectorDeep(selector, root = document) {
        let element = root.querySelector(selector);
        if (element) return element;

        const all = root.querySelectorAll('*');
        for (const el of all) {
            if (el.shadowRoot) {
                element = this.querySelectorDeep(selector, el.shadowRoot);
                if (element) return element;
            }
        }
        return null;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorGenerator;
} else {
    window.LocatorGenerator = LocatorGenerator;
}