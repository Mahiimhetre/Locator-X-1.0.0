// DOM Scanner - Content Script for Element Detection and Locator Generation
class DOMScanner {
    constructor() {
        this.isActive = false;
        this.isLocked = false;
        this.highlightedElement = null;
        this.lastRightClickedElement = null;
        this.overlay = this.createOverlay();
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
                const results = this.evaluateSelector(message.selector);
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
                    const info = this.getElementInfo(element);
                    const type = this.getElementType(element);

                    console.log('[Locator-X] Sending message:', { locators, info, type });

                    chrome.runtime.sendMessage({
                        action: 'locatorsGenerated',
                        locators: locators,
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
        this.animationFrameId = requestAnimationFrame(this.updateOverlayLoop);
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
        // Clear previous highlights
        this.clearMatchHighlights();

        if (!selector) return;

        try {
            let matches = [];
            const isXpath = selector.startsWith('/') || selector.startsWith('(');

            if (isXpath) {
                const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < Math.min(result.snapshotLength, 50); i++) {
                    matches.push(result.snapshotItem(i));
                }
            } else {
                matches = Array.from(document.querySelectorAll(selector)).slice(0, 50);
            }

            // Using overlay for the first match instead of adding classes
            if (matches.length > 0) {
                const firstMatch = matches[0];

                // Scroll into view first
                if (firstMatch.scrollIntoView) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                // Highlight with sticky overlay
                this.highlightElement(firstMatch);
            } else {
                this.clearHighlight();
            }

        } catch (e) {
            console.warn('Error highlighting matches:', e);
        }
    }

    clearMatchHighlights() {
        // Just clear the overlay highlight mechanism
        this.clearHighlight();
        // Also clean up any legacy classes just in case
        const highlighted = document.querySelectorAll('.locator-x-highlight');
        highlighted.forEach(el => el.classList.remove('locator-x-highlight'));
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

    evaluateSelector(selector) {
        if (!selector) return { count: 0 };
        try {
            let matches = [];
            let count = 0;

            const isXpath = selector.startsWith('/') || selector.startsWith('(');
            if (isXpath) {
                const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                count = result.snapshotLength;
            } else {
                const nodes = document.querySelectorAll(selector);
                count = nodes.length;
            }

            return { count };
        } catch (e) {
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
}

// Initialize scanner
console.log('[Locator-X] DOMScanner script loaded');
const domScanner = new DOMScanner();