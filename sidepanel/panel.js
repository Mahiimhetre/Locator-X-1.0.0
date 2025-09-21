// Locator-X Web Extension - UI Controller
// Clean, minimal implementation with dependency synchronization

const LocatorX = {
    // Tab Management
    tabs: {
        current: 'home',
        
        init() {
            document.getElementById('navHome').addEventListener('click', () => this.switch('home'));
            document.getElementById('navPOM').addEventListener('click', () => this.switch('pom'));
            this.switch('home');
        },
        
        switch(tab) {
            // Update UI
            document.querySelectorAll('.nav-option').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.home-container, .pom-content').forEach(el => el.classList.remove('active'));
            
            if (tab === 'home') {
                document.getElementById('navHome').classList.add('active');
                document.querySelector('.home-container').classList.add('active');
                this.updateScope('bi-house', 'Home');
            } else {
                document.getElementById('navPOM').classList.add('active');
                document.querySelector('.pom-content').classList.add('active');
                this.updateScope('bi-diagram-3', 'POM');
            }
            this.current = tab;
        },
        
        updateScope(icon, text) {
            const scopeIcon = document.getElementById('scopeIcon');
            const scopeText = document.getElementById('scopeText');
            if (scopeIcon && scopeText) {
                scopeIcon.className = icon;
                scopeText.textContent = text;
            }
        }
    },

    // Theme Management
    theme: {
        current: 'light',
        
        init() {
            this.load();
            document.getElementById('themeBtn').addEventListener('click', () => this.toggle());
        },
        
        toggle() {
            this.current = this.current === 'light' ? 'dark' : 'light';
            this.apply();
            localStorage.setItem('locator-x-theme', this.current);
        },
        
        apply() {
            document.body.classList.toggle('dark-theme', this.current === 'dark');
        },
        
        load() {
            this.current = localStorage.getItem('locator-x-theme') || 'light';
            this.apply();
        }
    },

    // Dropdown Management
    dropdowns: {
        list: [
            { btn: 'navFilterButton', dropdown: 'filterDropdown' },
            { btn: 'navMultiSelect', dropdown: 'multiSelectDropdown' },
            { btn: 'navAbout', dropdown: 'aboutDropdown' },
            { btn: 'navHistory', dropdown: 'customDropdown' },
            { btn: 'navSettings', dropdown: 'settingsDropdown' }
        ],
        
        init() {
            this.list.forEach(({ btn, dropdown }) => {
                const btnEl = document.getElementById(btn);
                const dropdownEl = document.getElementById(dropdown);
                
                if (btnEl && dropdownEl) {
                    btnEl.addEventListener('click', () => this.toggle(btn, dropdown));
                    dropdownEl.addEventListener('click', e => e.stopPropagation());
                }
            });
            
            document.addEventListener('click', e => {
                if (!e.target.closest('.nav-item')) this.closeAll();
            });
        },
        
        toggle(targetBtn, targetDropdown) {
            this.list.forEach(({ btn, dropdown }) => {
                const el = document.getElementById(dropdown);
                const btnEl = document.getElementById(btn);
                
                if (dropdown === targetDropdown) {
                    const isVisible = el.style.display === 'block';
                    el.style.display = isVisible ? 'none' : 'block';
                    btnEl.classList.toggle('active', !isVisible);
                } else {
                    el.style.display = 'none';
                    btnEl.classList.remove('active');
                }
            });
        },
        
        closeAll() {
            this.list.forEach(({ btn, dropdown }) => {
                document.getElementById(dropdown).style.display = 'none';
                document.getElementById(btn).classList.remove('active');
            });
        }
    },

    // Locator Filter Management
    filters: {
        init() {
            this.setupSelectAll();
            this.setupCheckboxes();
            this.setupRelativeXPath();
            this.setupScopeSwitch();
        },
        
        setupSelectAll() {
            const selectAll = document.getElementById('locTypeAll');
            const checkboxes = document.querySelectorAll('.loc-type');
            const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');
            
            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    checkboxes.forEach(cb => cb.checked = selectAll.checked);
                    nestedCheckboxes.forEach(cb => {
                        cb.checked = selectAll.checked && cb.id === 'xpathLocator';
                    });
                    this.updateNestedIcon();
                });
            }
        },
        
        setupCheckboxes() {
            const selectAll = document.getElementById('locTypeAll');
            const checkboxes = document.querySelectorAll('.loc-type');
            const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');
            
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const allChecked = Array.from(checkboxes).every(c => c.checked);
                    const noneChecked = Array.from(checkboxes).every(c => !c.checked);
                    
                    if (selectAll) {
                        selectAll.checked = allChecked;
                        selectAll.indeterminate = !allChecked && !noneChecked;
                    }
                });
            });
            
            nestedCheckboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const relativeXPath = document.getElementById('relativeXPath');
                    const anyNested = Array.from(nestedCheckboxes).some(c => c.checked);
                    
                    if (relativeXPath) {
                        relativeXPath.checked = anyNested;
                    }
                    this.updateNestedIcon();
                });
            });
        },
        
        setupRelativeXPath() {
            const arrow = document.getElementById('relativeDropdownArrow');
            const nested = document.getElementById('relativeXPathNested');
            const checkbox = document.getElementById('relativeXPath');
            const nestedIcon = document.getElementById('nestedSelectAll');
            
            if (arrow && nested) {
                arrow.addEventListener('click', e => {
                    e.stopPropagation();
                    const isVisible = nested.style.display === 'block';
                    nested.style.display = isVisible ? 'none' : 'block';
                    arrow.classList.toggle('expanded', !isVisible);
                    if (!isVisible) nested.classList.add('show-above');
                });
                
                nested.addEventListener('click', e => e.stopPropagation());
            }
            
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (!checkbox.checked) {
                        document.querySelectorAll('.nested-loc-type').forEach(cb => cb.checked = false);
                    }
                });
            }
            
            if (nestedIcon) {
                nestedIcon.addEventListener('click', e => {
                    e.stopPropagation();
                    const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');
                    const allChecked = Array.from(nestedCheckboxes).every(cb => cb.checked);
                    nestedCheckboxes.forEach(cb => cb.checked = !allChecked);
                    this.updateNestedIcon();
                });
            }
            
            document.addEventListener('click', e => {
                if (!e.target.closest('.relative-xpath-container')) {
                    nested.style.display = 'none';
                    arrow.classList.remove('expanded');
                }
            });
        },
        
        setupScopeSwitch() {
            const switchBtn = document.getElementById('switchScopeBtn');
            if (switchBtn) {
                switchBtn.addEventListener('click', () => {
                    const newTab = LocatorX.tabs.current === 'home' ? 'pom' : 'home';
                    LocatorX.tabs.switch(newTab);
                });
            }
        },
        
        updateNestedIcon() {
            const icon = document.getElementById('nestedSelectAll');
            const checkboxes = document.querySelectorAll('.nested-loc-type');
            
            if (icon) {
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                icon.className = allChecked ? 
                    'bi-check2-square nested-select-all all-selected' : 
                    'bi-square nested-select-all';
            }
        }
    },

    // Dependency Synchronization
    dependencies: {
        init() {
            const framework = document.getElementById('frameworkSelect');
            const language = document.getElementById('languageSelect');
            
            if (framework) {
                framework.addEventListener('change', e => 
                    this.updateDisplay('frameworkDisplay', e.target.value));
                this.updateDisplay('frameworkDisplay', framework.value);
            }
            
            if (language) {
                language.addEventListener('change', e => 
                    this.updateDisplay('languageDisplay', e.target.value));
                this.updateDisplay('languageDisplay', language.value);
            }
        },
        
        updateDisplay(displayId, value) {
            const display = document.getElementById(displayId);
            if (display) display.textContent = value;
        }
    },

    // Initialize all modules
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.tabs.init();
            this.theme.init();
            this.dropdowns.init();
            this.filters.init();
            this.dependencies.init();
        });
    }
};

// Initialize the application
LocatorX.init();

// Export API for external use
window.LocatorXAPI = {
    switchToHome: () => LocatorX.tabs.switch('home'),
    switchToPOM: () => LocatorX.tabs.switch('pom'),
    getCurrentTab: () => LocatorX.tabs.current,
    toggleTheme: () => LocatorX.theme.toggle(),
    getCurrentTheme: () => LocatorX.theme.current,
    closeAllDropdowns: () => LocatorX.dropdowns.closeAll()
};