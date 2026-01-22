// DOM Scanner - Content Script for Element Detection and Locator Generation
class DOMScanner {
    constructor() {
        this.isActive = false;
        this.isLocked = false;
        this.highlightedElement = null;
        this.lastRightClickedElement = null;
        this.matchedElements = []; // The elements currently matched
        this.axesState = { step: 0, anchor: null }; // Axes capture state
        this.generator = new LocatorGenerator();
        this.labelElement = null; // Private label element
        this.setupEventListeners();

        // Load config from storage logic
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['excludeNumbers'], (result) => {
                const val = result.excludeNumbers !== undefined ? result.excludeNumbers : true;
                if (this.generator) this.generator.setConfig({ excludeNumbers: val });
            });
        }
    }

    // Universal highlight clearing function
    // Universal highlight clearing function
    clearHighlights(scope = 'active') {
        const clearMatches = scope === 'matches' || scope === 'all';

        // 1. Clear Active Hover
        if ((scope === 'active' || scope === 'all') && this.highlightedElement) {
            // In Axes mode, preserve anchor highlight unless explicitly told to clear 'axes' or 'all'
            if (this.currentMode === 'axes' && this.highlightedElement === this.axesState.anchor) {
                // Skip anchor
            } else {
                this.restoreMatchOrClear(this.highlightedElement, clearMatches);
                this.hideLabel();
            }
            this.highlightedElement = null;
        }

        // 2. Clear Axes
        if (scope === 'axes' || scope === 'all') {
            if (this.axesState.anchor) this.restoreMatchOrClear(this.axesState.anchor, clearMatches);
            if (this.axesState.target) this.restoreMatchOrClear(this.axesState.target, clearMatches);
        }

        // 3. Clear Matches
        if (clearMatches) {
            if (this.matchedElements) {
                this.matchedElements.forEach(el => {
                    const currentHigh = el.getAttribute('lx-high');
                    if (currentHigh === 'match') el.removeAttribute('lx-high');
                });
                this.matchedElements = [];
            }
        }
    }

    restoreMatchOrClear(element, clearMatches) {
        if (!element) return;
        if (!clearMatches && this.matchedElements.includes(element)) {
            element.setAttribute('lx-high', 'match');
        } else {
            element.removeAttribute('lx-high');
        }
    }

    setupEventListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'startScanning') {
                this.startScanning(message.mode);
                sendResponse({ success: true });
            } else if (message.action === 'stopScanning') {
                this.stopScanning(message.force);
                sendResponse({ success: true });
            } else if (message.action === 'evaluateSelector') {
                try {
                    console.log('[DOMScanner] evaluateSelector request:', message.selector, message.type);
                    const results = this.evaluateSelector(message.selector, message.type, message.enableSmartCorrect);
                    console.log('[DOMScanner] evaluateSelector results:', results);
                    sendResponse(results);
                } catch (e) {
                    console.error('[DOMScanner] evaluateSelector error:', e);
                    sendResponse({ error: e.toString() });
                }
            } else if (message.action === 'getPageStructure') {
                const structure = this.getPageStructure();
                sendResponse(structure);
            } else if (message.action === 'contextMenuLocator') {
                this.handleContextMenuLocator(message.type);
            } else if (message.action === 'highlightMatches') {
                this.highlightMatches(message.selector);
            } else if (message.action === 'clearMatchHighlights') {
                this.clearHighlights('matches');
            } else if (message.action === 'swapAxes') {
                this.swapAxes();
            } else if (message.action === 'updateConfig') {
                if (this.generator) this.generator.setConfig(message.config);
            }
        });

        // Global tracker for context menu

        // Use mousedown (button 2) to trigger update BEFORE the menu opens
        document.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right click
                this.lastRightClickedElement = e.target;
                this.updateContextMenuForElement(e.target);
            }
        }, true);

        document.addEventListener('contextmenu', (e) => {
            const element = e.target;
            this.lastRightClickedElement = element;
            // Fallback update in case mousedown didn't catch it
            this.updateContextMenuForElement(element);
        }, true);

        // Throttled mouse move
        this.handleMouseMove = this.throttle(this.handleMouseMove.bind(this), 50);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleRightClick = this.handleRightClick.bind(this);
    }

    updateContextMenuForElement(element) {
        if (!element) return;

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

    swapAxes() {
        if (!this.axesState.anchor || !this.axesState.target) return;

        // 1. Swap State
        const temp = this.axesState.anchor;
        this.axesState.anchor = this.axesState.target;
        this.axesState.target = temp;

        // 2. Swap Visual Highlights
        this.clearHighlights('axes');
        this.axesState.anchor.setAttribute('lx-high', 'anchor');
        this.axesState.target.setAttribute('lx-high', 'target');

        // 3. Regenerate Result
        const result = this.generator.generateAxesXPath(this.axesState.anchor, this.axesState.target);
        const info = this.getElementDetails(this.axesState.target);

        // 4. Send Update
        chrome.runtime.sendMessage({
            action: 'axesResult',
            locator: result || 'No Axes relationship found!',
            elementInfo: info,
            matchCount: result ? this.generator.countMatches(result, 'xpath') : 0
        });
    }

    startScanning(mode = 'home') {
        if (this.isActive) return;

        this.isActive = true;
        this.currentMode = mode;

        // Reset Axes State
        if (mode === 'axes') {
            this.axesState = { step: 1, anchor: null };
        } else {
            this.axesState = { step: 0, anchor: null };
        }

        document.addEventListener('mousemove', this.handleMouseMove, true);
        document.addEventListener('click', this.handleMouseClick, true);
        document.addEventListener('keydown', this.handleKeyPress, true);
        document.addEventListener('contextmenu', this.handleRightClick, true);

        this.clearHighlights('active');
        this.clearHighlights('axes');
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

        if (force) {
            this.clearHighlights('active');
            this.clearHighlights('axes');
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }

    handleMouseMove(event) {
        if (!this.isActive || this.isLocked) return;

        // Use composedPath to find the real element inside Shadow DOM
        const element = event.composedPath ? event.composedPath()[0] : event.target;

        if (element === this.highlightedElement ||
            element.closest && element.closest(`#${LocatorXConfig.IDENTIFIERS.ROOT_ID}`)) return;

        this.highlightElement(element);
    }

    handleMouseClick(event) {
        try {
            if (!this.isActive || this.isLocked) return;

            event.preventDefault();
            event.stopPropagation();

            // Lock briefly to prevent double-clicks/jitter
            this.isLocked = true;
            setTimeout(() => {
                if (this.isActive) this.isLocked = false;
            }, 500);

            // Use composedPath to find the real element inside Shadow DOM
            const element = event.composedPath ? event.composedPath()[0] : event.target;

            if (!element) return;

            // Handle Axes Mode Logic
            if (this.currentMode === 'axes') {
                if (this.axesState.step === 1) {
                    // Capture Anchor
                    this.axesState.anchor = element;
                    this.axesState.step = 2; // Move to Target step

                    // Highlight for Anchor
                    element.setAttribute('lx-high', 'anchor');

                    chrome.runtime.sendMessage({
                        action: 'axesAnchorCaptured',
                        elementInfo: this.getElementDetails(element)
                    });
                    return;
                } else if (this.axesState.step === 2) {
                    // Capture Target & Generate Result
                    const anchor = this.axesState.anchor;

                    // Highlight for Target
                    element.setAttribute('lx-high', 'target');
                    this.axesState.target = element; // Store target for swapping

                    const result = this.generator.generateAxesXPath(anchor, element);
                    const info = this.getElementDetails(element);

                    this.stopScanning();

                    chrome.runtime.sendMessage({
                        action: 'axesResult',
                        locator: result || 'No Axes relationship found!',
                        elementInfo: info,
                        matchCount: result ? this.generator.countMatches(result, 'xpath') : 0
                    });

                    return;
                }
            }

            const isInIframe = this.detectIframe();
            const isCrossOrigin = this.isCrossOriginIframe();
            const isDynamic = this.isDynamicElement(element);
            let iframeXPath = null;

            if (isInIframe && !isCrossOrigin) {
                iframeXPath = this.getIframeXPath();
            }

            // Always generate ALL supported locator types
            // This decouples generation from visibility (which is handled in the UI)
            // Determine types based on mode
            let targetTypes = [
                'idLocator', 'nameLocator', 'classNameLocator', 'tagnameLocator',
                'cssLocator', 'linkTextLocator', 'pLinkTextLocator', 'absoluteLocator',
                'xpathLocator', 'containsXpathLocator', 'indexedXpathLocator',
                'linkTextXpathLocator', 'pLinkTextXpathLocator', 'attributeXpathLocator',
                'cssXpathLocator', 'jsPathLocator'
            ];

            let locators = this.generateLocators(element, targetTypes);
            const info = this.getElementInfo(element);
            const type = this.getElementType(element);

            chrome.runtime.sendMessage({
                action: 'locatorsGenerated',
                locators: locators,
                elementInfo: info,
                elementType: type,
                metadata: {
                    isInIframe,
                    isCrossOrigin,
                    isDynamic,
                    iframeXPath
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
            if (this.isActive) this.clearHighlights('active'); // Only auto-clear while picking
            return;
        }

        // Clean previous
        if (this.highlightedElement && this.highlightedElement !== element) {
            this.clearHighlights('active');
        }

        this.highlightedElement = element;
        const ids = LocatorXConfig.IDENTIFIERS;

        // Add highlight attribute
        // Check current mode to set value if needed (default to empty or 'home')
        const mode = this.currentMode && this.currentMode !== 'axes' ? this.currentMode : 'home';

        // For Axes, we use 'anchor' or 'target', handled by logic above.
        // But for hover, we just show standard highlight unless strict axes logic prevails.
        // In Axes mode, hover is essentially "potential target" (step 2) or "potential anchor" (step 1)
        let highlightValue = (mode === 'home') ? '' : mode;
        if (this.currentMode === 'axes') {
            if (element === this.axesState.anchor) {
                highlightValue = 'anchor';
            } else { highlightValue = (this.axesState.step === 1) ? 'anchor' : 'target'; }
        }

        element.setAttribute('lx-high', highlightValue);

        element.setAttribute('lx-high', highlightValue);

        // Update Label
        this.updateLabel(element);
    }

    createLabel() {
        if (this.labelElement) return;
        this.labelElement = document.createElement('div');
        this.labelElement.className = 'lx-high-label';
        this.labelElement.style.display = 'none';
        document.documentElement.appendChild(this.labelElement);
    }

    updateLabel(element) {
        // Only show label for special types
        const labelText = this.getElementType(element);

        if (!labelText) {
            this.hideLabel();
            return;
        }

        if (!this.labelElement) this.createLabel();

        const rect = element.getBoundingClientRect();

        // Calculate position (Fixed)
        // Check if we have space on top, otherwise show below
        const labelHeight = 20;
        let top = rect.top - labelHeight;
        if (top < 0) top = rect.bottom; // Flip to bottom if out of view

        this.labelElement.textContent = labelText;
        this.labelElement.style.top = `${top}px`;
        this.labelElement.style.left = `${rect.left}px`;
        this.labelElement.style.display = 'block';
    }

    hideLabel() {
        if (this.labelElement) this.labelElement.style.display = 'none';
    }

    highlightMatches(selector) {
        this.clearHighlights('matches');
        if (!selector) return;

        try {
            let matches = [];

            // 1. Try CSS
            try {
                if (!this.generator) this.generator = new LocatorGenerator();
                matches = this.generator.querySelectorAllDeep(selector).slice(0, 21);
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
                    for (let i = 0; i < Math.min(result.snapshotLength, 21); i++) { xpathNodes.push(result.snapshotItem(i)); }

                    if (xpathNodes.length > 0) { matches = Array.from(new Set([...matches, ...xpathNodes])).slice(0, 21); }
                } catch (e) { }
            }

            this.matchedElements = matches;

            // Highlight all matches
            if (matches.length > 0) {
                console.log(`[Locator-X] Highlighting ${matches.length} matches`);
                const firstMatch = matches[0];
                if (firstMatch.scrollIntoView) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                }

                matches.forEach(el => {
                    el.setAttribute('lx-high', 'match');
                });
            } else {
                this.clearHighlights('active');
            }
        } catch (e) {
            if (e.name === 'SyntaxError' || e instanceof DOMException) { return; }
            console.warn(`Error highlighting matches for "${selector}":`, e);
        }
    }

    generateLocators(element, enabledTypes = []) {
        // Use full locator generator
        if (!this.generator) { this.generator = new LocatorGenerator(); }
        return this.generator.generateLocators(element, enabledTypes);
    }

    evaluateSelector(selector, type = null, enableSmartCorrect = false) {
        if (!selector) return { count: 0, status: 'none' };
        try {
            if (!this.generator) { this.generator = new LocatorGenerator(); }

            // Map UI display name back to strategy key if possible
            const displayToStrategy = {};
            if (typeof LocatorXConfig !== 'undefined' && LocatorXConfig.STRATEGY_NAMES) {
                Object.entries(LocatorXConfig.STRATEGY_NAMES).forEach(([key, value]) => {
                    displayToStrategy[value] = key;
                });
            }

            const strategy = displayToStrategy[type] || (LocatorXConfig.STRATEGY_NAMES[type] ? type : null);
            const { count, suggestion } = this.generator.validateLocator(selector, strategy, enableSmartCorrect);

            const status = { count: count };
            if (suggestion) status.suggestedLocator = suggestion;

            // Fetch extra info if single match (useful for detail panel)
            if (count === 1) {
                try {
                    let element = null;
                    if (strategy === 'xpath' || selector.startsWith('/') || selector.startsWith('(')) {
                        element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    } else {
                        element = this.generator.querySelectorDeep(selector);
                    }

                    if (element) {
                        status.elementInfo = this.getElementInfo(element);
                        status.elementType = this.getElementType(element);

                        // Metadata for iframe context
                        const isInIframe = this.detectIframe();
                        const isCrossOrigin = this.isCrossOriginIframe();
                        const iframeXPath = isInIframe ? this.getIframeXPath() : null;

                        status.metadata = {
                            isInIframe,
                            isCrossOrigin,
                            iframeXPath
                        };

                        // Restore locator generation for the search bar detail view
                        const allTypes = [
                            'idLocator', 'nameLocator', 'classNameLocator', 'tagnameLocator',
                            'cssLocator', 'linkTextLocator', 'pLinkTextLocator', 'absoluteLocator',
                            'xpathLocator', 'containsXpathLocator', 'indexedXpathLocator',
                            'linkTextXpathLocator', 'pLinkTextXpathLocator', 'attributeXpathLocator',
                            'cssXpathLocator', 'jsPathLocator'
                        ];
                        let locators = this.generateLocators(element, allTypes);

                        // Prepend iframe XPath if in non-cross-origin iframe - REMOVED
                        // if (isInIframe && !isCrossOrigin && iframeXPath) { ... }
                        status.locators = locators;
                    }
                } catch (e) { }
            }
            return status;
        } catch (e) {
            if (e.name === 'SyntaxError' || e instanceof DOMException) { return { count: 0, status: 'none' }; }
            console.warn(`Error evaluating selector "${selector}":`, e);
            return { count: 0, status: 'none' };
        }
    }

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
            const ids = LocatorXConfig.IDENTIFIERS;
            if (el.id && !el.id.toLowerCase().startsWith(ids.ID_PREFIX.toLowerCase())) {
                structure.ids[el.id] = (structure.ids[el.id] || 0) + 1;
            }

            // Classes
            if (el.classList.length > 0) {
                el.classList.forEach(cls => {
                    if (!cls.startsWith(ids.ID_PREFIX)) { // Using prefix for broad exclusion
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

    // Return structured info for Axes processing
    getElementDetails(element) {
        if (!element) return { tagName: 'unknown' };
        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || '',
            className: typeof element.className === 'string' ? element.className : ''
        };
    }

    getElementInfo(element) {
        if (!element) return '';

        const tagName = element.tagName.toLowerCase();
        let attrs = '';

        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            let value = attr.value;

            // Skip extension-specific attributes
            const dataAttrs = LocatorXConfig.IDENTIFIERS.DATA_ATTRIBUTES;
            if (dataAttrs.includes(attr.name)) continue;

            // Clean up class attribute
            if (attr.name === 'class') {
                // Use centralized logic from LocatorGenerator if available
                if (this.generator && this.generator.filterClassNames) {
                    value = this.generator.filterClassNames(value).join(' ');
                } else {
                    // Fallback if generator not ready (unlikely)
                    // Fallback if generator not ready (unlikely)
                    value = value.trim();
                }
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

    // --- Iframe Awareness Methods ---

    detectIframe() {
        return window.self !== window.top;
    }

    isCrossOriginIframe() {
        if (!this.detectIframe()) return false;
        try {
            // Check if we can access top document
            return !window.top.document;
        } catch (e) {
            return true;
        }
    }

    getIframeXPath() {
        if (!this.detectIframe() || this.isCrossOriginIframe()) return null;
        try {
            const frame = window.frameElement;
            if (frame) {
                if (!this.generator) this.generator = new LocatorGenerator();
                return this.generator.generateRelativeXPath(frame);
            }
        } catch (e) { }
        return "//iframe";
    }



    isDynamicElement(element) {
        if (!element) return false;

        const id = element.id;
        const className = element.className;

        // Check ID for dynamic patterns
        if (id) {
            // Common dynamic patterns:
            // 1. Long random strings (e.g. "a1b2c3d4")
            // 2. Timestamps or sequences (e.g. "input-123456789")
            // 3. Framework specific (e.g. "j_id_1")
            if (/\d{4,}/.test(id) || // Contains 4+ digits
                /[a-f0-9]{8,}/.test(id) || // Long hex string
                /^ember\d+/.test(id) ||
                /^j_id/.test(id) ||
                /^[:.-]/.test(id)) {
                return true;
            }
        }

        // Check Class for dynamic patterns
        if (className && typeof className === 'string') {
            const classes = className.split(/\s+/);
            for (const cls of classes) {
                if (/\d{4,}/.test(cls) || // Contains 4+ digits
                    /^[a-z]{1,2}-[a-z0-9]{6,}/i.test(cls)) { // weird framework classes like css-1x2y3z
                    return true;
                }
            }
        }

        return false;
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



}

// Initialize scanner
console.log('[Locator-X] DOMScanner script loaded');
const domScanner = new DOMScanner();