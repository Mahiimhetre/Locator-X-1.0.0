// DOM Scanner - Content Script for Element Detection and Locator Generation
class DOMScanner {
    constructor() {
        this.isActive = false;
        this.isLocked = false;
        this.highlightedElement = null;
        this.lastRightClickedElement = null;
        this.overlay = null; // Lazy init
        this.matchOverlays = []; // Pool for multi-match highlights
        this.matchedElements = []; // The elements currently matched
        this.animationFrameId = null;
        this.axesState = { step: 0, anchor: null }; // Axes capture state
        this.axesOverlays = []; // Persistent overlays for Axes
        this.generator = new LocatorGenerator();
        this.setupEventListeners();
        this.updateOverlayLoop = this.updateOverlayLoop.bind(this);
    }

    // Clear specific axes overlays
    clearAxesOverlays() {
        if (this.axesOverlays) {
            this.axesOverlays.forEach(ol => ol.remove());
            this.axesOverlays = [];
        }
    }

    createPersistentOverlay(element, type) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const div = document.createElement('div');
        div.className = `lx-ovl ${type}`; // 'anchor' or 'target'
        div.style.position = 'absolute';
        div.style.left = '0';
        div.style.top = '0';
        div.style.transform = `translate3d(${rect.left + scrollX}px, ${rect.top + scrollY}px, 0)`;
        div.style.width = `${rect.width}px`;
        div.style.height = `${rect.height}px`;
        div.style.zIndex = '2147483646'; // Below the main overlay (ends in 7)
        div.style.pointerEvents = 'none';
        div.style.display = 'block';

        // Add label ONLY if it's a special type (e.g. Shadow Content)
        // User requested: "if it has sudo elemtn (label) with that highlight that also should keep"
        const specialType = this.getElementType(element);
        if (specialType && specialType !== 'Normal') {
            div.setAttribute('data-label', specialType);
        }

        document.body.appendChild(div);
        this.axesOverlays.push(div);
    }

    getOverlay() {
        if (this.overlay) return this.overlay;
        const ids = LocatorXConfig.IDENTIFIERS;
        this.overlay = document.createElement('div');
        this.overlay.className = ids.OVERLAY_CLASS;
        this.overlay.id = ids.ROOT_ID;
        this.overlay.style.display = 'none';
        // Append to documentElement for maximum isolation
        document.documentElement.appendChild(this.overlay);
        return this.overlay;
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

            } else if (message.action === 'swapAxes') {
                this.swapAxes();
            }
        });

        // Global tracker for context menu
        document.addEventListener('contextmenu', (e) => {
            const overlay = this.getOverlay();
            const element = (e.target === overlay) ? this.highlightedElement : e.target;
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

    swapAxes() {
        if (!this.axesState.anchor || !this.axesState.target) return;

        // 1. Swap State
        const temp = this.axesState.anchor;
        this.axesState.anchor = this.axesState.target;
        this.axesState.target = temp;

        // 2. Swap Visual Overlays
        // We need to find the specific overlays for each element.
        // Simplified approach: Iterate all axes overlays and toggle their class based on element

        this.axesOverlays.forEach(overlay => {
            // Check bounding rect matching (approximate solution since we don't store ref map)
            // Or better, clear and recreate? Recreating is safer and cleaner logic.
        });

        // Better Approach: Clear and Recreate Overlays with new roles
        this.clearAxesOverlays();
        this.createPersistentOverlay(this.axesState.anchor, 'anchor');
        this.createPersistentOverlay(this.axesState.target, 'target');

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

        // Apply mode-specific class to overlay
        const overlay = this.getOverlay();
        overlay.classList.remove('axes', 'pom', 'home', 'anchor', 'target');
        if (mode && mode !== 'axes') overlay.classList.add(mode);
        // For axes, classes are added dynamically in highlightElement based on step

        document.addEventListener('mousemove', this.handleMouseMove, true);
        document.addEventListener('click', this.handleMouseClick, true);
        document.addEventListener('keydown', this.handleKeyPress, true);
        document.addEventListener('contextmenu', this.handleRightClick, true);
        // We use requestAnimationFrame instead of scroll/resize events for better stickiness
        this.startOverlayLoop();

        this.clearHighlight();
        this.clearAxesOverlays();
        this.isLocked = false;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
    }



    stopScanning(force = false) {
        if (this.isActive && !force) {
            // check logic
        }

        this.isActive = false;

        // Reset overlay classes
        const overlay = this.getOverlay();
        overlay.classList.remove('axes', 'pom');

        document.removeEventListener('mousemove', this.handleMouseMove, true);
        document.removeEventListener('click', this.handleMouseClick, true);
        document.removeEventListener('keydown', this.handleKeyPress, true);
        document.removeEventListener('contextmenu', this.handleRightClick, true);

        this.stopOverlayLoop();

        if (force) {
            this.clearHighlight();
            this.clearAxesOverlays();
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }

    handleMouseMove(event) {
        if (!this.isActive || this.isLocked) return;

        // Use composedPath to find the real element inside Shadow DOM
        const element = event.composedPath ? event.composedPath()[0] : event.target;
        const overlay = this.getOverlay();

        if (element === this.highlightedElement ||
            element === overlay ||
            element.closest && element.closest(`#${LocatorXConfig.IDENTIFIERS.ROOT_ID}`)) return;

        if (this.currentMode === 'axes') {
            overlay.classList.remove('anchor', 'target');
            if (this.axesState.step === 1) overlay.classList.add('anchor'); // Yellow
            else if (this.axesState.step === 2) overlay.classList.add('target'); // Purple
        }

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
            const target = event.composedPath ? event.composedPath()[0] : event.target;
            const overlay = this.getOverlay();
            const element = target === overlay ? this.highlightedElement : target;

            if (!element) return;



            // Handle Axes Mode Logic
            if (this.currentMode === 'axes') {
                if (this.axesState.step === 1) {
                    // Capture Anchor
                    this.axesState.anchor = element;
                    this.axesState.step = 2; // Move to Target step

                    // Create persistent overlay for Anchor
                    this.createPersistentOverlay(element, 'anchor');

                    chrome.runtime.sendMessage({
                        action: 'axesAnchorCaptured',
                        elementInfo: this.getElementDetails(element)
                    });
                    // Force overlay update for color change immediately
                    const overlay = this.getOverlay();
                    overlay.classList.remove('anchor');
                    overlay.classList.add('target');
                    return;
                } else if (this.axesState.step === 2) {
                    // Capture Target & Generate Result
                    const anchor = this.axesState.anchor;

                    // Create persistent overlay for Target
                    this.createPersistentOverlay(element, 'target');
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
                'LinkTextXpathLocator', 'PLinkTextXpathLocator', 'attributeXpathLocator',
                'cssXpathLocator', 'jsPathLocator'
            ];



            let locators = this.generateLocators(element, targetTypes);

            // If in same-origin iframe, combine XPaths
            if (isInIframe && !isCrossOrigin && iframeXPath) {
                locators = locators.map(loc => {
                    if (loc.type.includes('XPath')) {
                        return {
                            ...loc,
                            locator: `${iframeXPath}/descendant::${loc.locator.replace(/^\/\/+/, '')}`
                        };
                    }
                    return loc;
                });
            }

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
            if (this.isActive) this.clearHighlight(); // Only auto-clear while picking
            return;
        }

        const overlay = this.getOverlay();
        this.highlightedElement = element;
        overlay.style.display = 'block';
        this.repositionOverlay();

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
                // Check if element is visible
                if (rect.width > 0 && rect.height > 0) {
                    overlay.style.display = 'block';
                    overlay.style.transform = `translate3d(${rect.left + scrollX}px, ${rect.top + scrollY}px, 0)`;
                    overlay.style.width = `${rect.width}px`;
                    overlay.style.height = `${rect.height}px`;
                } else {
                    overlay.style.display = 'none';
                }
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
                console.log(`[Locator-X] Highlighting ${matches.length} matches`);
                const firstMatch = matches[0];
                if (firstMatch.scrollIntoView) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                }
                this.highlightElement(firstMatch);

                // Setup secondary overlays if needed
                if (matches.length > 1) {
                    this.ensureMatchOverlays(matches.length - 1);
                }

                // Force loop ensure
                this.startOverlayLoop();
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
        // Pool overlays to avoid constant DOM churn
        const ids = LocatorXConfig.IDENTIFIERS;
        while (this.matchOverlays.length < count && this.matchOverlays.length < 20) {
            const div = document.createElement('div');
            div.className = ids.MATCH_OVERLAY_CLASS;
            div.style.display = 'none';
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
        if (!selector) return { count: 0, status: 'none' };
        try {
            if (!this.generator) {
                this.generator = new LocatorGenerator();
            }

            // Map UI display name back to strategy key if possible
            const displayToStrategy = {};
            if (typeof LocatorXConfig !== 'undefined' && LocatorXConfig.STRATEGY_NAMES) {
                Object.entries(LocatorXConfig.STRATEGY_NAMES).forEach(([key, value]) => {
                    displayToStrategy[value] = key;
                });
            }

            const strategy = displayToStrategy[type] || null;
            const count = this.generator.countMatches(selector, strategy);
            const status = { count: count };

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
                            'LinkTextXpathLocator', 'PLinkTextXpathLocator', 'attributeXpathLocator',
                            'cssXpathLocator', 'jsPathLocator'
                        ];
                        let locators = this.generateLocators(element, allTypes);

                        // Prepend iframe XPath if in non-cross-origin iframe
                        if (isInIframe && !isCrossOrigin && iframeXPath) {
                            locators = locators.map(loc => {
                                if (loc.type.includes('XPath')) {
                                    return {
                                        ...loc,
                                        locator: `${iframeXPath}/descendant::${loc.locator.replace(/^\/\/+/, '')}`
                                    };
                                }
                                return loc;
                            });
                        }
                        status.locators = locators;
                    }
                } catch (e) { }
            }

            return status;
        } catch (e) {
            // Silence common syntax errors during typing
            if (e.name === 'SyntaxError' || e instanceof DOMException) {
                return { count: 0, status: 'none' };
            }
            console.warn(`Error evaluating selector "${selector}":`, e);
            return { count: 0, status: 'none' };
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
                const highlightClass = LocatorXConfig.IDENTIFIERS.HIGHLIGHT_CLASS;
                value = value.split(' ')
                    .filter(cls => !cls.includes(highlightClass))
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