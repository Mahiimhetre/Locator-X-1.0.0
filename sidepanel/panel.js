// ============================================================================
// LOCATOR-X WEB EXTENSION - UI CONTROLLER
// ============================================================================

// ============================================================================
// 1. TAB MANAGEMENT
// ============================================================================
const TabManager = {
    currentActiveTab: 'home',
    
    init() {
        this.setActiveTab('home');
        document.getElementById('navHome').addEventListener('click', () => this.switchToHome());
        document.getElementById('navPOM').addEventListener('click', () => this.switchToPOM());
    },
    
    switchToHome() {
        this.setActiveTab('home');
    },
    
    switchToPOM() {
        this.setActiveTab('pom');
    },
    
    getCurrentTab() {
        return this.currentActiveTab;
    },
    
    setActiveTab(tab) {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // Hide all content containers
        document.querySelectorAll('.home-container, .pom-content').forEach(container => {
            container.classList.remove('active');
        });
        
        // Update scope display
        const scopeIcon = document.getElementById('scopeIcon');
        const scopeText = document.getElementById('scopeText');
        
        // Set active tab and show content
        if (tab === 'home') {
            document.getElementById('navHome').classList.add('active');
            document.querySelector('.home-container').classList.add('active');
            this.currentActiveTab = 'home';
            if (scopeIcon && scopeText) {
                scopeIcon.className = 'bi-house';
                scopeText.textContent = 'Home';
            }
        } else if (tab === 'pom') {
            document.getElementById('navPOM').classList.add('active');
            document.querySelector('.pom-content').classList.add('active');
            this.currentActiveTab = 'pom';
            if (scopeIcon && scopeText) {
                scopeIcon.className = 'bi-diagram-3';
                scopeText.textContent = 'POM';
            }
        }
    }
};

// Global functions for external access
window.switchToHome = () => TabManager.switchToHome();
window.switchToPOM = () => TabManager.switchToPOM();
window.getCurrentTab = () => TabManager.getCurrentTab();

// ============================================================================
// 2. THEME MANAGEMENT
// ============================================================================
const ThemeManager = {
    currentTheme: 'light',
    
    init() {
        this.loadTheme();
        document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());
    },
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveTheme(this.currentTheme);
    },
    
    getCurrentTheme() {
        return this.currentTheme;
    },
    
    applyTheme(theme) {
        const body = document.body;
        if (theme === 'dark') {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
    },
    
    saveTheme(theme) {
        localStorage.setItem('locator-x-theme', theme);
    },
    
    loadTheme() {
        const savedTheme = localStorage.getItem('locator-x-theme');
        this.currentTheme = savedTheme || 'light';
        this.applyTheme(this.currentTheme);
    }
};

// Global functions for external access
window.toggleTheme = () => ThemeManager.toggleTheme();
window.getCurrentTheme = () => ThemeManager.getCurrentTheme();

// ============================================================================
// 3. DROPDOWN MANAGEMENT
// ============================================================================
const DropdownManager = {
    dropdowns: [
        { btn: 'navFilterButton', dropdown: 'filterDropdown' },
        { btn: 'navMultiSelect', dropdown: 'multiSelectDropdown' },
        { btn: 'navAbout', dropdown: 'aboutDropdown' },
        { btn: 'navCustom', dropdown: 'customDropdown' },
        { btn: 'navSettings', dropdown: 'settingsDropdown' }
    ],
    
    init() {
        this.setupDropdowns();
        this.setupOutsideClickHandler();
    },
    
    setupDropdowns() {
        this.dropdowns.forEach(({ btn, dropdown }) => {
            const btnElement = document.getElementById(btn);
            const dropdownElement = document.getElementById(dropdown);

            if (btnElement && dropdownElement) {
                btnElement.addEventListener('click', () => {
                    this.toggleDropdown(btn, dropdown);
                });

                dropdownElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        });
    },
    
    toggleDropdown(targetBtn, targetDropdown) {
        // Close all other dropdowns
        this.dropdowns.forEach(({ btn, dropdown }) => {
            if (dropdown !== targetDropdown) {
                const element = document.getElementById(dropdown);
                const btnElement = document.getElementById(btn);
                if (element) element.style.display = 'none';
                if (btnElement) btnElement.classList.remove('active');
            }
        });
        
        // Toggle target dropdown
        const dropdownElement = document.getElementById(targetDropdown);
        const btnElement = document.getElementById(targetBtn);
        const isVisible = dropdownElement.style.display === 'block';
        dropdownElement.style.display = isVisible ? 'none' : 'block';
        btnElement.classList.toggle('active', !isVisible);
    },
    
    setupOutsideClickHandler() {
        document.addEventListener('click', (e) => {
            const isNavItem = e.target.closest('.nav-item');
            if (!isNavItem) {
                this.closeAllDropdowns();
            }
        });
    },
    
    closeAllDropdowns() {
        this.dropdowns.forEach(({ btn, dropdown }) => {
            const dropdownElement = document.getElementById(dropdown);
            const btnElement = document.getElementById(btn);
            if (dropdownElement) dropdownElement.style.display = 'none';
            if (btnElement) btnElement.classList.remove('active');
        });
    }
};

// ============================================================================
// 4. LOCATOR FILTER MANAGEMENT
// ============================================================================
const LocatorFilterManager = {
    elements: {},
    
    init() {
        this.cacheElements();
        this.setupMainSelectAll();
        this.setupIndividualCheckboxes();
        this.setupRelativeXPathDropdown();
        this.setupNestedSelectAll();
        this.setupNestedCheckboxes();
        this.setupScopeSwitch();
        this.setupOutsideClickHandler();
        this.updateNestedSelectAllIcon();
    },
    
    cacheElements() {
        this.elements = {
            selectAllCheckbox: document.getElementById('locTypeAll'),
            locTypeCheckboxes: document.querySelectorAll('.loc-type'),
            nestedLocTypeCheckboxes: document.querySelectorAll('.nested-loc-type'),
            relativeXPathCheckbox: document.getElementById('relativeXPath'),
            relativeXPathNested: document.getElementById('relativeXPathNested'),
            relativeDropdownArrow: document.getElementById('relativeDropdownArrow'),
            nestedSelectAllIcon: document.getElementById('nestedSelectAll'),
            switchScopeBtn: document.getElementById('switchScopeBtn'),
            scopeIcon: document.getElementById('scopeIcon'),
            scopeText: document.getElementById('scopeText')
        };
    },
    
    // Main Select All (includes Relative XPath with default XPath)
    setupMainSelectAll() {
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.addEventListener('change', () => {
                this.elements.locTypeCheckboxes.forEach(checkbox => {
                    checkbox.checked = this.elements.selectAllCheckbox.checked;
                });
                
                // If selecting all, also check only the default XPath nested option
                if (this.elements.selectAllCheckbox.checked) {
                    this.elements.nestedLocTypeCheckboxes.forEach(checkbox => {
                        checkbox.checked = checkbox.id === 'xpathLocator';
                    });
                } else {
                    // If deselecting all, uncheck all nested options
                    this.elements.nestedLocTypeCheckboxes.forEach(checkbox => {
                        checkbox.checked = false;
                    });
                }
                this.updateNestedSelectAllIcon();
            });
        }
    },
    
    // Individual outer checkboxes (includes Relative XPath in select all calculation)
    setupIndividualCheckboxes() {
        this.elements.locTypeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const allChecked = Array.from(this.elements.locTypeCheckboxes).every(cb => cb.checked);
                const noneChecked = Array.from(this.elements.locTypeCheckboxes).every(cb => !cb.checked);
                
                if (this.elements.selectAllCheckbox) {
                    this.elements.selectAllCheckbox.checked = allChecked;
                    this.elements.selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
                }
            });
        });
    },
    
    // Relative XPath dropdown functionality
    setupRelativeXPathDropdown() {
        if (this.elements.relativeXPathCheckbox && this.elements.relativeDropdownArrow) {
            // Arrow click handler
            this.elements.relativeDropdownArrow.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleRelativeXPathNested();
            });

            // Checkbox change handler
            this.elements.relativeXPathCheckbox.addEventListener('change', () => {
                if (this.elements.relativeXPathCheckbox.checked) {
                    this.elements.relativeXPathNested.style.display = 'block';
                    this.elements.relativeDropdownArrow.classList.add('expanded');
                } else {
                    this.elements.nestedLocTypeCheckboxes.forEach(checkbox => {
                        checkbox.checked = false;
                    });
                }
            });
        }
        
        // Prevent nested dropdown from closing when clicking inside
        if (this.elements.relativeXPathNested) {
            this.elements.relativeXPathNested.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    },
    
    toggleRelativeXPathNested() {
        const isVisible = this.elements.relativeXPathNested.style.display === 'block';
        
        if (!isVisible) {
            // Always show above since Relative XPath is typically in bottom rows
            this.elements.relativeXPathNested.classList.add('show-above');
        }
        
        this.elements.relativeXPathNested.style.display = isVisible ? 'none' : 'block';
        this.elements.relativeDropdownArrow.classList.toggle('expanded', !isVisible);
    },
    
    // Nested select all icon functionality
    setupNestedSelectAll() {
        if (this.elements.nestedSelectAllIcon) {
            this.elements.nestedSelectAllIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const allChecked = Array.from(this.elements.nestedLocTypeCheckboxes).every(cb => cb.checked);
                this.elements.nestedLocTypeCheckboxes.forEach(checkbox => {
                    checkbox.checked = !allChecked;
                });
                this.updateNestedSelectAllIcon();
            });
        }
    },
    
    // Individual nested checkboxes (update parent Relative XPath)
    setupNestedCheckboxes() {
        this.elements.nestedLocTypeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const anyNestedChecked = Array.from(this.elements.nestedLocTypeCheckboxes).some(cb => cb.checked);
                
                if (this.elements.relativeXPathCheckbox) {
                    if (anyNestedChecked && !this.elements.relativeXPathCheckbox.checked) {
                        this.elements.relativeXPathCheckbox.checked = true;
                    } else if (!anyNestedChecked && this.elements.relativeXPathCheckbox.checked) {
                        this.elements.relativeXPathCheckbox.checked = false;
                    }
                }
                
                this.updateNestedSelectAllIcon();
            });
        });
    },
    
    updateNestedSelectAllIcon() {
        const allNestedChecked = Array.from(this.elements.nestedLocTypeCheckboxes).every(cb => cb.checked);
        if (this.elements.nestedSelectAllIcon) {
            if (allNestedChecked) {
                this.elements.nestedSelectAllIcon.className = 'bi-check2-square nested-select-all all-selected';
            } else {
                this.elements.nestedSelectAllIcon.className = 'bi-square nested-select-all';
            }
        }
    },
    
    // Scope switch functionality
    setupScopeSwitch() {
        if (this.elements.switchScopeBtn) {
            this.elements.switchScopeBtn.addEventListener('click', () => {
                const currentTab = TabManager.getCurrentTab();
                if (currentTab === 'home') {
                    TabManager.switchToPOM();
                    this.elements.scopeIcon.className = 'bi-diagram-3';
                    this.elements.scopeText.textContent = 'POM';
                } else {
                    TabManager.switchToHome();
                    this.elements.scopeIcon.className = 'bi-house';
                    this.elements.scopeText.textContent = 'Home';
                }
            });
        }
    },
    
    // Close nested dropdown when clicking outside
    setupOutsideClickHandler() {
        document.addEventListener('click', (e) => {
            const relativeXPathContainer = document.querySelector('.relative-xpath-container');
            if (relativeXPathContainer && this.elements.relativeXPathNested && 
                !relativeXPathContainer.contains(e.target)) {
                this.elements.relativeXPathNested.style.display = 'none';
                if (this.elements.relativeDropdownArrow) {
                    this.elements.relativeDropdownArrow.classList.remove('expanded');
                }
            }
        });
    },
    
    // API Methods for Web Extension
    getSelectedLocators() {
        const selected = [];
        this.elements.locTypeCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push({
                    id: checkbox.id,
                    value: checkbox.value,
                    type: 'outer'
                });
            }
        });
        
        this.elements.nestedLocTypeCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push({
                    id: checkbox.id,
                    value: checkbox.value,
                    type: 'nested'
                });
            }
        });
        
        return selected;
    },
    
    setLocatorState(locatorId, checked) {
        const checkbox = document.getElementById(locatorId);
        if (checkbox) {
            checkbox.checked = checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    }
};

// ============================================================================
// 5. INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    TabManager.init();
    ThemeManager.init();
    DropdownManager.init();
    LocatorFilterManager.init();
});

// ============================================================================
// 6. WEB EXTENSION API
// ============================================================================
window.LocatorXAPI = {
    // Tab Management
    switchToHome: () => TabManager.switchToHome(),
    switchToPOM: () => TabManager.switchToPOM(),
    getCurrentTab: () => TabManager.getCurrentTab(),
    
    // Theme Management
    toggleTheme: () => ThemeManager.toggleTheme(),
    getCurrentTheme: () => ThemeManager.getCurrentTheme(),
    
    // Locator Management
    getSelectedLocators: () => LocatorFilterManager.getSelectedLocators(),
    setLocatorState: (locatorId, checked) => LocatorFilterManager.setLocatorState(locatorId, checked),
    
    // Dropdown Management
    closeAllDropdowns: () => DropdownManager.closeAllDropdowns()
};