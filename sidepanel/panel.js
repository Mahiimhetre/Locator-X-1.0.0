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
                LocatorX.filters.saveCurrentFilters('pom');
                LocatorX.filters.loadFilters('home');
                document.getElementById('navHome').classList.add('active');
                document.querySelector('.home-container').classList.add('active');
                this.updateScope('bi-house', 'Home');
                LocatorX.filters.updateTable();
            } else {
                LocatorX.filters.saveCurrentFilters('home');
                LocatorX.filters.loadFilters('pom');
                document.getElementById('navPOM').classList.add('active');
                document.querySelector('.pom-content').classList.add('active');
                this.updateScope('bi-diagram-3', 'POM');
                LocatorX.filters.updatePOMTable();
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
        homeFilters: {},
        pomFilters: {},
        
        init() {
            this.setupSelectAll();
            this.setupCheckboxes();
            this.setupRelativeXPath();
            this.setupScopeSwitch();
            this.saveCurrentFilters('home');
            this.updateTable();
        },
        
        saveCurrentFilters(tab) {
            const filters = {};
            document.querySelectorAll('.loc-type').forEach(cb => {
                filters[cb.id] = cb.checked;
            });
            document.querySelectorAll('.nested-loc-type').forEach(cb => {
                filters[cb.id] = cb.checked;
            });
            
            if (tab === 'home') {
                this.homeFilters = filters;
            } else {
                this.pomFilters = filters;
            }
        },
        
        loadFilters(tab) {
            const filters = tab === 'home' ? this.homeFilters : this.pomFilters;
            if (Object.keys(filters).length === 0) return;
            
            Object.keys(filters).forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = filters[id];
            });
            
            this.updateNestedIcon();
        },
        
        updateFiltersForDependencies() {
            const framework = document.getElementById('frameworkSelect').value;
            const language = document.getElementById('languageSelect').value;
            
            // Framework-specific filter rules
            if (framework === 'cypress') {
                this.disableFilter('linkTextLocator');
                this.disableFilter('pLinkTextLocator');
            } else {
                this.enableFilter('linkTextLocator');
                this.enableFilter('pLinkTextLocator');
            }
            
            if (framework === 'playwright') {
                this.enableFilter('cssLocator');
                this.enableFilter('xpathLocator');
            }
            
            // Language-specific filter rules
            if (language === 'js') {
                this.enableFilter('cssLocator');
            }
            
            // Update tables based on current tab
            if (LocatorX.tabs.current === 'home') {
                this.updateTable();
            } else {
                this.updatePOMTable();
            }
        },
        
        disableFilter(filterId) {
            const checkbox = document.getElementById(filterId);
            if (checkbox) {
                checkbox.checked = false;
                checkbox.disabled = true;
                checkbox.parentElement.style.opacity = '0.5';
            }
        },
        
        enableFilter(filterId) {
            const checkbox = document.getElementById(filterId);
            if (checkbox) {
                checkbox.disabled = false;
                checkbox.parentElement.style.opacity = '1';
            }
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
                    
                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else if (LocatorX.tabs.current === 'pom') {
                        this.updatePOMTable();
                    }
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
                    
                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else {
                        this.updatePOMTable();
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
                    
                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else {
                        this.updatePOMTable();
                    }
                });
            });
        },
        
        updateTable() {
            const tbody = document.querySelector('.locator-table tbody');
            if (!tbody) return;
            
            const checkedTypes = this.getCheckedTypes();
            tbody.innerHTML = '';
            
            checkedTypes.forEach(type => {
                const matchCount = Math.floor(Math.random() * 4);
                const matchClass = matchCount === 0 ? 'match-none' : 
                                 matchCount === 1 ? 'match-single' : 'match-multiple';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="match-count ${matchClass}">${matchCount}</span></td>
                    <td>${type}</td>
                    <td class="editable">sample-${type.toLowerCase()}</td>
                    <td>
                        <i class="bi-clipboard" title="Copy"></i>
                        <i class="bi-bookmark-plus" title="Save"></i>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            this.updatePOMTable();
        },
        
        updatePOMTable() {
            const pomTable = document.querySelector('.pom-table');
            if (!pomTable) return;
            
            const checkedTypes = this.getCheckedTypes();
            const thead = pomTable.querySelector('thead tr');
            const tbody = pomTable.querySelector('tbody');
            
            // Update header
            thead.innerHTML = '<th>#</th>';
            checkedTypes.forEach(type => {
                thead.innerHTML += `<th>${type}</th>`;
            });
            thead.innerHTML += '<th>Actions</th>';
            
            // Update existing rows or create sample row
            if (tbody.children.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td>1</td>';
                checkedTypes.forEach(type => {
                    row.innerHTML += `<td class="editable">sample-${type.toLowerCase()}</td>`;
                });
                row.innerHTML += `<td><i class="bi-clipboard" title="Copy"></i><i class="bi-trash" title="Delete"></i></td>`;
                tbody.appendChild(row);
            } else {
                // Update existing rows
                Array.from(tbody.children).forEach((row, index) => {
                    const cells = row.querySelectorAll('td');
                    const newRow = document.createElement('tr');
                    newRow.innerHTML = `<td>${index + 1}</td>`;
                    
                    checkedTypes.forEach((type, i) => {
                        const existingValue = cells[i + 1] ? cells[i + 1].textContent : `sample-${type.toLowerCase()}`;
                        newRow.innerHTML += `<td class="editable">${existingValue}</td>`;
                    });
                    
                    newRow.innerHTML += `<td><i class="bi-clipboard" title="Copy"></i><i class="bi-trash" title="Delete"></i></td>`;
                    row.replaceWith(newRow);
                });
            }
        },
        
        getCheckedTypes() {
            const types = [];
            const typeMap = {
                'idLocator': 'ID',
                'nameLocator': 'Name',
                'tagnameLocator': 'TagName',
                'classNameLocator': 'ClassName',
                'cssLocator': 'CSS',
                'linkTextLocator': 'LinkText',
                'pLinkTextLocator': 'Partial LinkText',
                'absoluteLocator': 'Absolute XPath'
            };
            
            Object.keys(typeMap).forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox && checkbox.checked) {
                    types.push(typeMap[id]);
                }
            });
            
            const relativeXPath = document.getElementById('relativeXPath');
            if (relativeXPath && relativeXPath.checked) {
                const nestedTypes = {
                    'xpathLocator': 'XPath',
                    'containsXpathLocator': 'Contains XPath',
                    'indexedXpathLocator': 'Indexed XPath',
                    'LinkTextXpathLocator': 'Link Text XPath',
                    'PLinkTextXpathLocator': 'Partial Link XPath',
                    'attributeXpathLocator': 'Attribute XPath',
                    'cssXpathLocator': 'CSS XPath'
                };
                
                Object.keys(nestedTypes).forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox && checkbox.checked) {
                        types.push(nestedTypes[id]);
                    }
                });
            }
            
            return types;
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
                framework.addEventListener('change', e => {
                    this.updateDisplay('frameworkDisplay', e.target.value);
                    LocatorX.filters.updateFiltersForDependencies();
                });
                this.updateDisplay('frameworkDisplay', framework.value);
            }
            
            if (language) {
                language.addEventListener('change', e => {
                    this.updateDisplay('languageDisplay', e.target.value);
                    LocatorX.filters.updateFiltersForDependencies();
                });
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
            this.table.init();
            this.savedLocators.init();
            this.notifications.init();
        });
    },

    // Notification System
    notifications: {
        init() {
            this.container = document.getElementById('notificationContainer');
        },
        
        show(message, type = 'info', duration = 3000) {
            if (!this.container) return;
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            const icons = {
                success: 'bi-check-circle',
                error: 'bi-x-circle',
                warning: 'bi-exclamation-triangle',
                info: 'bi-info-circle'
            };
            
            notification.innerHTML = `
                <i class="${icons[type] || icons.info}"></i>
                <span>${message}</span>
            `;
            
            this.container.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 100);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        },
        
        confirm(message, title = 'Confirm') {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'confirmation-overlay';
                
                const dialog = document.createElement('div');
                dialog.className = 'confirmation-dialog';
                dialog.innerHTML = `
                    <div class="confirmation-header">${title}</div>
                    <div class="confirmation-body">${message}</div>
                    <div class="confirmation-actions">
                        <button class="confirmation-btn secondary" data-action="cancel">Cancel</button>
                        <button class="confirmation-btn primary" data-action="confirm">Confirm</button>
                    </div>
                `;
                
                document.body.appendChild(overlay);
                document.body.appendChild(dialog);
                
                const cleanup = () => {
                    overlay.remove();
                    dialog.remove();
                };
                
                dialog.addEventListener('click', (e) => {
                    if (e.target.dataset.action === 'confirm') {
                        cleanup();
                        resolve(true);
                    } else if (e.target.dataset.action === 'cancel') {
                        cleanup();
                        resolve(false);
                    }
                });
                
                overlay.addEventListener('click', () => {
                    cleanup();
                    resolve(false);
                });
            });
        },
        
        success(message, duration) { this.show(message, 'success', duration); },
        error(message, duration) { this.show(message, 'error', duration); },
        warning(message, duration) { this.show(message, 'warning', duration); },
        info(message, duration) { this.show(message, 'info', duration); }
    },

    // Saved Locators Management
    savedLocators: {
        init() {
            this.updateDropdown();
        },
        
        updateDropdown() {
            const dropdown = document.getElementById('aboutDropdown');
            if (!dropdown) return;
            
            const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
            
            if (saved.length === 0) {
                dropdown.innerHTML = `
                    <div class="dropdown-header">
                        <strong>Saved Locators</strong>
                    </div>
                    <div class="dropdown-content">
                        <div class="empty-state">
                            <i class="bi-bookmark" style="font-size: 24px; color: var(--border-dark); margin-bottom: 8px;"></i>
                            <p style="color: var(--secondary-text); margin: 0;">No saved locators</p>
                        </div>
                    </div>
                `;
            } else {
                let content = `
                    <div class="dropdown-header">
                        <strong>Saved Locators</strong>
                    </div>
                    <div class="dropdown-content">
                `;
                
                saved.forEach((item, index) => {
                    content += `
                        <div class="saved-item" data-index="${index}">
                            <div class="saved-row">
                                <span class="saved-name">${item.name}</span>
                                <span class="saved-type">${item.type}</span>
                                <i class="bi-clipboard saved-copy" title="Copy"></i>
                                <i class="bi-x saved-delete" title="Delete"></i>
                            </div>
                            <div class="saved-locator">${item.locator}</div>
                        </div>
                    `;
                });
                
                content += '</div>';
                dropdown.innerHTML = content;
                
                this.setupSavedActions();
            }
        },
        
        setupSavedActions() {
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('saved-copy')) {
                    const item = e.target.closest('.saved-item');
                    const locator = item.querySelector('.saved-locator').textContent;
                    navigator.clipboard.writeText(locator);
                    LocatorX.notifications.success('Copied!');
                }
                
                if (e.target.classList.contains('saved-delete')) {
                    const item = e.target.closest('.saved-item');
                    const index = parseInt(item.dataset.index);
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                    saved.splice(index, 1);
                    localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                    this.updateDropdown();
                    LocatorX.notifications.success('Deleted!');
                }
            });
        }
    },

    // Table Management
    table: {
        init() {
            this.setupCopyButtons();
            this.setupEditableCells();
            this.setupSaveButton();
        },
        
        setupSaveButton() {
            const saveBtn = document.querySelector('.save-btn');
            const saveInput = document.querySelector('.save-input');
            const searchInput = document.querySelector('.search-input');
            
            if (saveBtn && saveInput && searchInput) {
                saveBtn.addEventListener('click', async () => {
                    const locator = searchInput.value.trim();
                    let name = saveInput.value.trim();
                    
                    if (!locator) {
                        LocatorX.notifications.error('Please enter a locator in the search field');
                        return;
                    }
                    
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                    const existing = saved.find(item => item.locator === locator);
                    
                    if (existing) {
                        // Check if existing has timestamp name (starts with date)
                        const isTimestampName = /^\d{4}-\d{2}-\d{2}/.test(existing.name);
                        
                        if (isTimestampName) {
                            // Direct rename without message
                            if (!name) {
                                name = new Date().toLocaleString();
                            }
                            existing.name = name;
                            localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                            LocatorX.notifications.success(`Locator renamed to "${name}"`);
                        } else {
                            // Ask for rename confirmation
                            const rename = await LocatorX.notifications.confirm(
                                `Locator already exists as "${existing.name}". Do you want to rename it?`,
                                'Rename Locator'
                            );
                            if (rename) {
                                if (!name) {
                                    name = new Date().toLocaleString();
                                }
                                existing.name = name;
                                localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                                LocatorX.notifications.success(`Locator renamed to "${name}"`);
                            } else {
                                LocatorX.notifications.info('Save cancelled');
                                return;
                            }
                        }
                    } else {
                        // New locator
                        if (!name) {
                            name = new Date().toLocaleString();
                        }
                        
                        saved.push({ 
                            name, 
                            type: 'Manual', 
                            locator, 
                            date: new Date().toISOString() 
                        });
                        localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                        LocatorX.notifications.success(`Locator saved as "${name}"`);
                    }
                    
                    saveInput.value = '';
                    LocatorX.savedLocators.updateDropdown();
                });
            }
        },
        
        setupCopyButtons() {
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('bi-clipboard')) {
                    const row = e.target.closest('tr');
                    const locatorCell = row.querySelector('.editable');
                    const locator = locatorCell.textContent;
                    navigator.clipboard.writeText(locator);
                    LocatorX.notifications.success('Locator copied to clipboard');
                }
                if (e.target.classList.contains('bi-bookmark-plus')) {
                    const row = e.target.closest('tr');
                    const locatorCell = row.querySelector('.editable');
                    const typeCell = row.cells[1];
                    const locator = locatorCell.textContent;
                    const type = typeCell.textContent;
                    
                    // Save with auto-generated name
                    const savedName = `${type}_${locator}`;
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                    saved.push({ name: savedName, type, locator, date: new Date().toISOString() });
                    localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                    LocatorX.savedLocators.updateDropdown();
                    LocatorX.notifications.success(`Locator saved as "${savedName}"`);
                }
                if (e.target.classList.contains('bi-trash')) {
                    const row = e.target.closest('tr');
                    row.remove();
                    this.updateRowNumbers();
                }
            });
        },
        
        updateRowNumbers() {
            const pomTable = document.querySelector('.pom-content .locator-table tbody');
            if (pomTable) {
                const rows = pomTable.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    row.cells[0].textContent = index + 1;
                });
            }
        },
        
        setupEditableCells() {
            document.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('editable')) {
                    this.makeEditable(e.target);
                }
            });
        },
        
        makeEditable(cell) {
            const currentValue = cell.textContent;
            cell.classList.add('editing');
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue;
            
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            input.select();
            
            const finishEdit = () => {
                cell.textContent = input.value || currentValue;
                cell.classList.remove('editing');
            };
            
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEdit();
                if (e.key === 'Escape') {
                    cell.textContent = currentValue;
                    cell.classList.remove('editing');
                }
            });
        }
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