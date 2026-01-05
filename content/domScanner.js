// DOM Scanner - Content Script for Element Detection and Locator Generation
class DOMScanner {
    constructor() {
        this.isActive = false;
        this.isLocked = false;
        this.highlightedElement = null;
        this.lastRightClickedElement = null;
        this.overlay = this.createOverlay();
        this.matchOverlays = []; // Pool for multi-match highlights
        this.matchedElements = []; // The elements currently matched
        this.animationFrameId = null;
        this.setupEventListeners();
        this.updateOverlayLoop = this.updateOverlayLoop.bind(this);
    }

    createOverlay() {
        const div = document.createElement('div');
        div.className = 'locator-x-overlay';
        div.id = 'locatorXOverlay';
        // Append to documentElement for maximum isolation from body transforms/margins
        document.documentElement.appendChild(div);
        return div;
    }

    setupEventListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'startScanning') {
                this.startScanning();
                sendResponse({ success: true });
            } else if (message.action === 'stopScanning') {
                this.stopScanning(message.force);
                sendResponse({ success: true });
            } else if (message.action === 'evaluateSelector') {
                const results = this.evaluateSelector(message.selector, message.type);
                sendResponse(results);
            } else if (message.action === 'getPageStructure') {
                const structure = this.getPageStructure();
                sendResponse(structure);
            } else if (message.action === 'contextMenuLocator') {
                this.handleContextMenuLocator(message.type);
            } else if (message.action === 'highlightMatches') {
                this.highlightMatches(message.selector);
            } else if (message.action === 'clearMatchHighlights') {
                this.clearMatchHighlights();
            } else if (message.action === 'healLocator') {
                const result = this.healLocator(message.fingerprint);
                sendResponse(result);
            }
        });

        // Global tracker for context menu
        document.addEventListener('contextmenu', (e) => {
            const element = (e.target.id === 'locatorXOverlay') ? this.highlightedElement : e.target;
            this.lastRightClickedElement = element;

            if (element) {
                // Defer generation to avoid blocking the menu appearance
                const defer = window.requestIdleCallback || window.setTimeout;
                defer(() => {
                    if (!this.generator) {
                        this.generator = new LocatorGenerator();
                    }

                    const values = {};
                    const strategies = [
                        'id', 'name', 'className', 'xpath', 'css', 'jsPath', 'absoluteXPath'
                    ];

                    strategies.forEach(strategy => {
                        try {
                            values[strategy] = this.generator.strategies[strategy](element) || 'Not available';
                        } catch (err) {
                            values[strategy] = 'Error generating';
                        }
                    });

                    chrome.runtime.sendMessage({
                        action: 'updateContextMenuValues',
                        values: values
                    });
                });
            }
        }, true);

        // Throttled mouse move
        this.handleMouseMove = this.throttle(this.handleMouseMove.bind(this), 50);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleRightClick = this.handleRightClick.bind(this);
    }

    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    startScanning() {
        if (this.isActive) return;

        this.isActive = true;
        document.addEventListener('mousemove', this.handleMouseMove, true);
        document.addEventListener('click', this.handleMouseClick, true);
        document.addEventListener('keydown', this.handleKeyPress, true);
        document.addEventListener('contextmenu', this.handleRightClick, true);
        // We use requestAnimationFrame instead of scroll/resize events for better stickiness
        this.startOverlayLoop();

        this.clearHighlight();
        this.isLocked = false;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
    }

    stopScanning(force = false) {
        if (this.isActive && !force) {
            // check logic
        }

        this.isActive = false;
        document.removeEventListener('mousemove', this.handleMouseMove, true);
        document.removeEventListener('click', this.handleMouseClick, true);
        document.removeEventListener('keydown', this.handleKeyPress, true);
        document.removeEventListener('contextmenu', this.handleRightClick, true);

        this.stopOverlayLoop();

        if (force) {
            this.clearHighlight();
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }

    handleMouseMove(event) {
        if (!this.isActive || this.isLocked) return;

        const element = event.target;
        if (element === this.highlightedElement ||
            element === this.overlay ||
            element.closest('#locatorXOverlay')) return;

        this.highlightElement(element);
    }

    handleMouseClick(event) {
        try {
            if (!this.isActive || this.isLocked) return;

            event.preventDefault();
            event.stopPropagation();
            console.log('[Locator-X] Click detected on:', event.target);

            // Lock briefly to prevent double-clicks/jitter
            this.isLocked = true;
            setTimeout(() => {
                if (this.isActive) this.isLocked = false;
            }, 500);

            const element = event.target === this.overlay ? this.highlightedElement : event.target;
            if (!element) {
                console.warn('[Locator-X] No element found to inspect');
                return;
            }

            chrome.storage.local.get(['enabledFilters'], (result) => {
                try {
                    const enabledTypes = result.enabledFilters || [];
                    console.log('[Locator-X] Generating locators with types:', enabledTypes);
                    const locators = this.generateLocators(element, enabledTypes);
                    const fingerprint = this.generator.generateFingerprint(element);
                    const info = this.getElementInfo(element);
                    const type = this.getElementType(element);

                    console.log('[Locator-X] Sending message:', { locators, info, type, fingerprint });

                    chrome.runtime.sendMessage({
                        action: 'locatorsGenerated',
                        locators: locators,
                        fingerprint: fingerprint,
                        elementInfo: info,
                        elementType: type
                    });
                } catch (err) {
                    console.error('[Locator-X] Error inside storage callback:', err);
                }
            });
        } catch (e) {
            console.error('[Locator-X] Error in handleMouseClick:', e);
        }
    }

    handleRightClick(event) {
        if (!this.isActive) return;
        event.preventDefault(); // Stop standard context menu
        event.stopPropagation();
        chrome.runtime.sendMessage({ action: 'deactivateInspect' });
        this.stopScanning(true); // Force clear highlight
    }


    handleKeyPress(event) {
        if (event.key === 'Escape') {
            chrome.runtime.sendMessage({ action: 'deactivateInspect' });
            this.stopScanning();
        }
    }

    highlightElement(element) {
        if (!element || element === document.body || element === document.documentElement) {
            if (this.isActive) this.clearHighlight(); // Only auto-clear while picking
            return;
        }

        this.highlightedElement = element;
        this.repositionOverlay();
        this.overlay.style.display = 'block';

        // Ensure loop is running if we are highlighting
        if (!this.animationFrameId) {
            this.startOverlayLoop();
        }
    }

    startOverlayLoop() {
        if (this.animationFrameId) return;
        this.updateOverlayLoop();
    }

    stopOverlayLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    updateOverlayLoop() {
        this.repositionOverlay();
        this.repositionMatchOverlays();
        this.animationFrameId = requestAnimationFrame(this.updateOverlayLoop);
    }

    repositionMatchOverlays() {
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        // Only show up to 20 matches for performance
        this.matchOverlays.forEach((overlay, i) => {
            const el = this.matchedElements[i + 1]; // First match uses primary overlay
            if (el) {
                const rect = el.getBoundingClientRect();
                overlay.style.display = 'block';
                overlay.style.transform = `translate3d(${rect.left + scrollX}px, ${rect.top + scrollY}px, 0)`;
                overlay.style.width = `${rect.width}px`;
                overlay.style.height = `${rect.height}px`;
            } else {
                overlay.style.display = 'none';
            }
        });
    }

    repositionOverlay() {
        if (!this.highlightedElement || !this.overlay) return;

        const rect = this.highlightedElement.getBoundingClientRect();

        // Hide overlay if element is not in viewport
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0 &&
            rect.left < window.innerWidth && rect.right > 0;

        if (!isInViewport) {
            // Optional: hide overlay or keep it off-screen
            // this.overlay.style.display = 'none';
            // return;
        }

        this.overlay.style.display = 'block';

        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        // Use transform for better performance and to avoid layout shifts.
        // Also more robust against parent element transforms when position is fixed.
        this.overlay.style.transform = `translate3d(${rect.left + scrollX}px, ${rect.top + scrollY}px, 0)`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;

        const label = this.getOverlayLabel(this.highlightedElement);
        if (this.overlay.getAttribute('data-label') !== label) {
            this.overlay.setAttribute('data-label', label);
        }
    }

    clearHighlight() {
        this.highlightedElement = null;
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    highlightMatches(selector) {
        this.clearMatchHighlights();
        if (!selector) return;

        try {
            let matches = [];

            // 1. Try CSS
            try {
                matches = Array.from(document.querySelectorAll(selector)).slice(0, 21);
            } catch (e) { }

            // 2. Try XPath if CSS failed or if it looks like XPath
            const looksLikeXpath = selector.startsWith('/') ||
                selector.startsWith('(') ||
                selector.startsWith('.//') ||
                selector.includes('//') ||
                selector.includes('text()') ||
                selector.includes('@');

            if (matches.length === 0 || looksLikeXpath) {
                try {
                    const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    const xpathNodes = [];
                    for (let i = 0; i < Math.min(result.snapshotLength, 21); i++) {
                        xpathNodes.push(result.snapshotItem(i));
                    }

                    // If XPath found something and CSS didn't, or if we want to prioritize XPath for these markers
                    if (xpathNodes.length > 0) {
                        // Merge or replace? For search bar, usually replace if it's clearly an XPath
                        matches = Array.from(new Set([...matches, ...xpathNodes])).slice(0, 21);
                    }
                } catch (e) { }
            }

            this.matchedElements = matches;

            // Focus the first match
            if (matches.length > 0) {
                const firstMatch = matches[0];
                if (firstMatch.scrollIntoView) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                }
                this.highlightElement(firstMatch);

                // Setup secondary overlays if needed
                if (matches.length > 1) {
                    this.ensureMatchOverlays(matches.length - 1);
                }
            } else {
                this.clearHighlight();
            }
        } catch (e) {
            // Silence common syntax errors during typing
            if (e.name === 'SyntaxError' || e instanceof DOMException) {
                return;
            }
            console.warn(`Error highlighting matches for "${selector}":`, e);
        }
    }

    ensureMatchOverlays(count) {
        while (this.matchOverlays.length < count && this.matchOverlays.length < 20) {
            const div = document.createElement('div');
            div.className = 'locator-x-match-overlay';
            document.documentElement.appendChild(div);
            this.matchOverlays.push(div);
        }
    }

    clearMatchHighlights() {
        this.matchedElements = [];
        this.clearHighlight();
        this.matchOverlays.forEach(o => o.style.display = 'none');
    }

    getOverlayLabel(element) {
        // Only show label for special types
        const type = this.getElementType(element);
        return type ? type : '';
    }

    generateLocators(element, enabledTypes = []) {
        // Use full locator generator
        if (!this.generator) {
            this.generator = new LocatorGenerator();
        }
        return this.generator.generateLocators(element, enabledTypes);
    }

    evaluateSelector(selector, type = null) {
        if (!selector) return { count: 0 };
        try {
            if (!this.generator) {
                this.generator = new LocatorGenerator();
            }

            // Map UI display name back to strategy key if possible
            const displayToStrategy = {
                'ID': 'id',
                'Name': 'name',
                'ClassName': 'className',
                'TagName': 'tagname',
                'CSS': 'css',
                'LinkText': 'linkText',
                'Partial LinkText': 'partialLinkText',
                'Absolute XPath': 'absoluteXPath',
                'XPath': 'xpath',
                'Contains XPath': 'containsXpath',
                'Indexed XPath': 'indexedXpath',
                'Link Text XPath': 'linkTextXpath',
                'Partial Link XPath': 'partialLinkTextXpath',
                'Attribute XPath': 'attributeXpath',
                'CSS XPath': 'cssXpath',
                'JS Path': 'jsPath'
            };

            const strategy = displayToStrategy[type] || null;
            const count = this.generator.countMatches(selector, strategy);

            return { count };
        } catch (e) {
            // Silence DOMExceptions for evaluateSelector as well
            if (e.name === 'SyntaxError' || e instanceof DOMException) {
                return { count: 0 };
            }
            console.warn(`Error evaluating selector "${selector}":`, e);
            return { count: 0, error: e.message };
        }
    }

    // Context menu methods removed - using native browser context menu

    getPageStructure() {
        const commonTags = [
            'div', 'span', 'a', 'button', 'input', 'form', 'img', 'label',
            'select', 'option', 'textarea', 'ul', 'li', 'ol', 'table',
            'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
            'nav', 'header', 'footer', 'section', 'article', 'aside', 'main'
        ];

        const structure = {
            tags: {},
            ids: {},
            classes: {},
            attributes: {
                name: {},
                role: {},
                'data-testid': {},
                placeholder: {}
            },
            textFragments: new Set()
        };

        // Scan all elements for a comprehensive map
        const allElements = document.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const tag = el.tagName.toLowerCase();

            // Tags
            if (commonTags.includes(tag)) {
                structure.tags[tag] = (structure.tags[tag] || 0) + 1;
            }

            // IDs
            if (el.id && !el.id.startsWith('locator-x')) {
                structure.ids[el.id] = (structure.ids[el.id] || 0) + 1;
            }

            // Classes
            if (el.classList.length > 0) {
                el.classList.forEach(cls => {
                    if (!cls.startsWith('locator-x')) {
                        structure.classes[cls] = (structure.classes[cls] || 0) + 1;
                    }
                });
            }

            // Attributes
            ['name', 'role', 'data-testid', 'placeholder'].forEach(attr => {
                const val = el.getAttribute(attr);
                if (val) {
                    structure.attributes[attr][val] = (structure.attributes[attr][val] || 0) + 1;
                }
            });

            // Text fragments (minimal threshold)
            if (el.children.length === 0 && el.textContent.trim().length > 2 && el.textContent.trim().length < 50) {
                const text = el.textContent.trim();
                structure.textFragments.add(text);
            }
        }

        // Convert Set to Array for JSON transmission
        structure.textFragments = Array.from(structure.textFragments).slice(0, 50);

        return structure;
    }

    getElementInfo(element) {
        if (!element) return '';

        const tagName = element.tagName.toLowerCase();
        let attrs = '';

        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            let value = attr.value;

            // Skip extension-specific attributes
            if (attr.name === 'data-locator-type' || attr.name === 'data-label') continue;

            // Clean up class attribute
            if (attr.name === 'class') {
                value = value.split(' ')
                    .filter(cls => !cls.includes('locator-x-highlight'))
                    .join(' ').trim();
                if (!value) continue;
            }

            attrs += ` ${attr.name}="${value}"`;
        }

        return `<${tagName}${attrs}>`;
    }

    getElementType(element) {
        // 1. Detect Context (Where am I?)
        const isInsideShadow = element.getRootNode() instanceof ShadowRoot;
        const isInsideFrame = window.self !== window.top;

        // 2. Detect Specific Element Types
        const tagName = element.tagName;
        let label = null;

        // --- Iframe Detection ---
        if (tagName === 'IFRAME' || tagName === 'FRAME') {
            label = 'Iframe';
            if (tagName === 'FRAME') label = 'Frame';

            // Check Origin/Sandbox
            try {
                const doc = element.contentDocument;
                if (!doc) throw new Error('Cross-origin');
                label += ' (Same-Origin)';
            } catch (e) {
                label += ' (Cross-Origin)';
            }

            if (element.hasAttribute('sandbox')) {
                label = label.replace(')', ', Sandboxed)');
            }

            if (isInsideShadow) label += ' (Shadow)';
            if (isInsideFrame) label += ' (Nested)';
        }
        // --- Shadow Host Detection ---
        else if (element.shadowRoot) {
            label = 'Shadow Host';
            if (isInsideShadow) label += ' (Nested)';
            if (isInsideFrame) label += ' (Frame)';
        }
        // --- Specific Elements ---
        else if (tagName === 'CANVAS') label = isInsideShadow ? 'Canvas (Shadow)' : 'Canvas';
        else if (element instanceof SVGElement) label = isInsideShadow ? 'SVG (Shadow)' : 'SVG';
        // --- Content Context ---
        else if (isInsideShadow) {
            label = isInsideFrame ? 'Shadow Content (Frame)' : 'Shadow Content';
        }
        else if (isInsideFrame) {
            label = 'Frame Content';
        }

        return label;
    }

    handleContextMenuLocator(menuId) {
        const element = this.lastRightClickedElement;
        if (!element) return;

        if (!this.generator) {
            this.generator = new LocatorGenerator();
        }

        const typeMap = {
            'copy-id': 'id',
            'copy-name': 'name',
            'copy-class': 'className',
            'copy-rel-xpath': 'xpath',
            'copy-css': 'css',
            'copy-js-path': 'jsPath',
            'copy-abs-xpath': 'absoluteXPath'
        };

        const strategy = typeMap[menuId];
        if (strategy) {
            const locator = this.generator.strategies[strategy](element);
            if (locator) {
                navigator.clipboard.writeText(locator).then(() => {
                    chrome.runtime.sendMessage({
                        action: 'notification',
                        type: 'success',
                        message: `Copied ${this.generator.getDisplayName(strategy)} to clipboard!`
                    });
                });
            } else {
                chrome.runtime.sendMessage({
                    action: 'notification',
                    type: 'error',
                    message: `Could not generate locator for ${strategy}`
                });
            }
        }
    }

    healLocator(fingerprint) {
        if (!window.HealingEngine) return { error: 'Healing Engine not loaded' };

        const engine = new HealingEngine();
        const start = performance.now();
        const match = engine.findBestMatch(fingerprint);
        const duration = performance.now() - start;

        if (match && match.element) {
            // Generate new locators for this element
            // We use the same generator logic
            if (!this.generator) this.generator = new LocatorGenerator();

            // We can return a specific robust locator (e.g. CSS or XPath) or a list
            // Let's return the standard list so user can choose
            const locators = this.generator.generateLocators(match.element, ['id', 'name', 'css', 'xpath']);

            return {
                success: true,
                match: {
                    score: match.score,
                    reasons: match.reasons,
                    tagName: match.element.tagName.toLowerCase(),
                    text: (match.element.textContent || '').substring(0, 30).trim()
                },
                locators: locators,
                duration: Math.round(duration)
            };
        }

        return { success: false, error: 'No matching element found' };
    }

}

// Initialize scanner
console.log('[Locator-X] DOMScanner script loaded');
const domScanner = new DOMScanner();