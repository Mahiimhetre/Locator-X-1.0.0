// DOM Scanner - Content Script for Element Detection and Locator Generation
class DOMScanner {
    constructor() {
        this.isActive = false;
        this.isLocked = false;
        this.highlightedElement = null;
        this.overlay = this.createOverlay();
        this.setupEventListeners();
        this.repositionOverlay = this.repositionOverlay.bind(this);
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
                this.stopScanning();
                sendResponse({ success: true });
            }
        });

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleRightClick = this.handleRightClick.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    startScanning() {
        if (this.isActive) return;

        this.isActive = true;
        document.addEventListener('mousemove', this.handleMouseMove, true);
        document.addEventListener('click', this.handleMouseClick, true);
        document.addEventListener('contextmenu', this.handleRightClick, true);
        document.addEventListener('keydown', this.handleKeyPress, true);
        window.addEventListener('scroll', this.repositionOverlay, true);
        window.addEventListener('resize', this.repositionOverlay, true);
        this.clearHighlight();
        this.isLocked = false;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
    }

    stopScanning() {
        if (!this.isActive) return;

        this.isActive = false;
        document.removeEventListener('mousemove', this.handleMouseMove, true);
        document.removeEventListener('click', this.handleMouseClick, true);
        document.removeEventListener('contextmenu', this.handleRightClick, true);
        document.removeEventListener('keydown', this.handleKeyPress, true);
        // Do NOT clearHighlight here to allow persistence
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
        if (!this.isActive || this.isLocked) return;

        event.preventDefault();
        event.stopPropagation();

        this.isLocked = true;

        const element = event.target === this.overlay ? this.highlightedElement : event.target;
        if (!element) return;

        chrome.storage.local.get(['enabledFilters'], (result) => {
            const enabledTypes = result.enabledFilters || [];
            const locators = this.generateLocators(element, enabledTypes);

            chrome.runtime.sendMessage({
                action: 'locatorsGenerated',
                locators: locators,
                elementInfo: this.getElementInfo(element)
            });
        });
    }

    handleRightClick(event) {
        if (!this.isActive) return;
        event.preventDefault();
        event.stopPropagation();
        chrome.runtime.sendMessage({ action: 'deactivateInspect' });
        this.stopScanning();
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
    }

    repositionOverlay() {
        if (!this.highlightedElement || !this.overlay) return;

        const rect = this.highlightedElement.getBoundingClientRect();

        // Hide overlay if element is not in viewport
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0 &&
            rect.left < window.innerWidth && rect.right > 0;

        if (!isInViewport) {
            this.overlay.style.display = 'none';
            return;
        }

        this.overlay.style.display = 'block';

        // Use transform for better performance and to avoid layout shifts.
        // Also more robust against parent element transforms when position is fixed.
        this.overlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
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

    getOverlayLabel(element) {
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const cls = element.className && typeof element.className === 'string' ?
            `.${element.className.split(' ')[0]}` : '';
        return `${tag}${id}${cls}`;
    }

    generateLocators(element, enabledTypes = []) {
        // Use full locator generator
        if (!this.generator) {
            this.generator = new LocatorGenerator();
        }
        return this.generator.generateLocators(element, enabledTypes);
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
}

// Initialize scanner
const domScanner = new DOMScanner();