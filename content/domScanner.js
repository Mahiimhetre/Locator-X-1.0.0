// DOM Scanner - Content Script for Element Detection and Locator Generation
class DOMScanner {
    constructor() {
        this.isActive = false;
        this.highlightedElement = null;
        this.setupStyles();
        this.setupEventListeners();
    }

    setupStyles() {
        // CSS is now loaded via manifest.json content_scripts
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
        document.body.style.userSelect = 'none';
    }

    stopScanning() {
        if (!this.isActive) return;
        
        this.isActive = false;
        document.removeEventListener('mousemove', this.handleMouseMove, true);
        document.removeEventListener('click', this.handleMouseClick, true);
        document.removeEventListener('contextmenu', this.handleRightClick, true);
        document.removeEventListener('keydown', this.handleKeyPress, true);
        this.clearHighlight();
        document.body.style.userSelect = '';
    }

    handleMouseMove(event) {
        if (!this.isActive) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        if (element === this.highlightedElement) return;
        
        this.highlightElement(element);
    }

    handleMouseClick(event) {
        if (!this.isActive) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        
        // Get enabled filters from storage or use defaults
        chrome.storage.local.get(['enabledFilters'], (result) => {
            const enabledTypes = result.enabledFilters || ['idLocator', 'classNameLocator', 'tagnameLocator'];
            
            // Generate locators using full generator
            const locators = this.generateLocators(element, enabledTypes);
            
            // Send locators to sidepanel
            chrome.runtime.sendMessage({
                action: 'locatorsGenerated',
                locators: locators
            });
        });
        
        // Don't stop scanning - let sidepanel decide based on mode
    }

    handleRightClick(event) {
        if (!this.isActive) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        // Send message to deactivate inspect mode
        chrome.runtime.sendMessage({ action: 'deactivateInspect' });
        
        this.stopScanning();
    }

    handleKeyPress(event) {
        if (event.key === 'Escape') {
            // Send message to deactivate inspect mode
            chrome.runtime.sendMessage({ action: 'deactivateInspect' });
            this.stopScanning();
        }
    }

    highlightElement(element) {
        this.clearHighlight();
        
        if (element && element !== document.body && element !== document.documentElement) {
            const elementType = this.getElementType(element);
            element.setAttribute('data-locator-type', elementType);
            element.classList.add('locator-x-highlight');
            this.highlightedElement = element;
        }
    }

    clearHighlight() {
        if (this.highlightedElement) {
            this.highlightedElement.classList.remove('locator-x-highlight');
            this.highlightedElement.removeAttribute('data-locator-type');
            this.highlightedElement = null;
        }
    }

    getElementType(element) {
        const tag = element.tagName.toLowerCase();
        const id = element.id;
        const className = element.className;
        
        if (id) return `${tag}#${id.substring(0, 15)}${id.length > 15 ? '...' : ''}`;
        if (className) {
            const cls = className.split(' ')[0];
            return `${tag}.${cls.substring(0, 12)}${cls.length > 12 ? '...' : ''}`;
        }
        return tag;
    }

    generateLocators(element, enabledTypes = []) {
        // Use full locator generator
        if (!this.generator) {
            this.generator = new LocatorGenerator();
        }
        return this.generator.generateLocators(element, enabledTypes);
    }

    getElementInfo(element) {
        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || '',
            className: element.className || '',
            textContent: element.textContent?.trim().substring(0, 50) || ''
        };
    }
}

// Initialize scanner
const domScanner = new DOMScanner();