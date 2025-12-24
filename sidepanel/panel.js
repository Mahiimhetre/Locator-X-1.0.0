// Locator-X Web Extension - UI Controller
// Clean, minimal implementation with dependency synchronization

const LocatorX = {
    core: null,
    modal: null,

    // POM Management
    pom: {
        currentPageId: null,

        init() {
            this.setupEventListeners();
            this.loadPages();
        },

        setupEventListeners() {
            const select = document.getElementById('pomPageSelect');
            const addBtn = document.getElementById('addPageBtn');
            const editBtn = document.getElementById('editPageBtn');
            const deleteBtn = document.getElementById('deletePageBtn');

            if (select) {
                select.addEventListener('change', (e) => this.switchPage(e.target.value));
            }

            if (addBtn) addBtn.addEventListener('click', () => this.createPage());
            if (editBtn) editBtn.addEventListener('click', () => this.renamePage());
            if (deleteBtn) deleteBtn.addEventListener('click', () => this.deletePage());
        },

        loadPages() {
            const pages = LocatorX.core.getPOMPages();
            const select = document.getElementById('pomPageSelect');
            if (!select) return;

            select.innerHTML = '<option value="" disabled selected>Select Page</option>';

            pages.forEach(page => {
                const option = document.createElement('option');
                option.value = page.id;
                option.textContent = page.name;
                select.appendChild(option);
            });

            // Restore last selected page or default
            if (this.currentPageId && pages.find(p => p.id === this.currentPageId)) {
                select.value = this.currentPageId;
                this.updateUI(this.currentPageId);
            } else if (pages.length > 0) {
                this.switchPage(pages[0].id);
            } else {
                this.updateUI(null);
            }
        },


        async createPage(defaultName = '') {
            const name = await LocatorX.modal.prompt(
                'Create New Page',
                defaultName,
                'Enter a descriptive name for your new POM page...'
            );
            if (!name) return null;

            const newPage = {
                id: `pom_${Date.now()}`,
                name: name,
                locators: []
            };

            LocatorX.core.savePOMPage(newPage);
            this.loadPages();
            this.switchPage(newPage.id);
            return newPage;
        },

        async renamePage() {
            if (!this.currentPageId) return;

            const pages = LocatorX.core.getPOMPages();
            const page = pages.find(p => p.id === this.currentPageId);
            if (!page) return;

            const newName = await LocatorX.modal.prompt(
                'Rename Page',
                page.name,
                `Enter a new name for "${page.name}"`
            );
            if (!newName || newName === page.name) return;

            page.name = newName;
            LocatorX.core.savePOMPage(page);
            this.loadPages();
        },

        async deletePage() {
            if (!this.currentPageId) return;

            const pages = LocatorX.core.getPOMPages();
            const page = pages.find(p => p.id === this.currentPageId);
            const pageName = page ? page.name : 'this page';

            const confirmed = await LocatorX.modal.confirm(
                'Delete Page',
                `Are you sure you want to delete <span style="font-weight:600; color:var(--status-red-text);">"${pageName}"</span>?<br>This action cannot be undone.`,
                { icon: 'bi-exclamation-triangle-fill' }
            );
            if (!confirmed) return;

            LocatorX.core.deletePOMPage(this.currentPageId);
            this.currentPageId = null;
            this.loadPages();
        },

        switchPage(pageId) {
            this.currentPageId = pageId;
            const select = document.getElementById('pomPageSelect');
            if (select) select.value = pageId;

            this.updateUI(pageId);
        },

        getCurrentPage() {
            if (!this.currentPageId) return null;
            const pages = LocatorX.core.getPOMPages();
            return pages.find(p => p.id === this.currentPageId);
        },

        addLocatorToPage(locator) {
            const page = this.getCurrentPage();
            if (!page) {
                alert('Please select or create a page first.');
                return;
            }

            // Check duplicates in the page
            const exists = page.locators.some(l => l.locator === locator.locator && l.type === locator.type);
            if (exists) return; // Silent return or notify

            page.locators.push(locator);
            LocatorX.core.savePOMPage(page);
            this.updateUI(this.currentPageId);
        },

        updateUI(pageId) {
            const editBtn = document.getElementById('editPageBtn');
            const deleteBtn = document.getElementById('deletePageBtn');
            const tableBody = document.querySelector('.pom-table tbody');

            if (!pageId) {
                if (editBtn) editBtn.classList.add('disabled');
                if (deleteBtn) deleteBtn.classList.add('disabled');
                if (tableBody) tableBody.innerHTML = '';
                return;
            }

            if (editBtn) editBtn.classList.remove('disabled');
            if (deleteBtn) deleteBtn.classList.remove('disabled');

            // Render Table
            this.renderTable(pageId);
        },

        renderTable(pageId) {
            const pages = LocatorX.core.getPOMPages();
            const page = pages.find(p => p.id === pageId);
            if (!page || !page.locators) return;

            // Reuse existing table update logic but with specific data
            // We need to adapt the existing updatePOMTable logic to handle stored locators
            // For now, let's just clear and show what we have

            const tbody = document.querySelector('.pom-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            // This part needs to be clever. The existing logic renders rows based on *scanned* results.
            // But here we are showing *saved* locators for the page. 
            // Ideally, a POM page is a list of ELEMENTS, and each element has multiple strategies.
            // OR, is it a list of chosen locators?
            // Looking at the requirement: "create multiple pom pages... add a navbar... backend"
            // Usually POM = Class with locators.

            // The previous Logic was:
            // updatePOMTable() -> takes generated locators and adds a row.

            // If we look at existing `displayGeneratedLocators` for POM:
            // It adds a row with columns for each enabled filter type.
            // So one row = one element, with multiple locator columns.

            // So our data structure for a page should be:
            // page.elements = [ { id:..., locators: [ {type: 'id', locator: '...'}, ... ] } ]

            // Let's adjust `addLocatorToPage` (actually we need to add an *element* with all its locators).
            // When scanning, `displayGeneratedLocators` is called with a LIST of locators for ONE element.

            // So:
            /*
            page: {
                elements: [
                    [ {type: 'id', locator:'...'}, {type: 'name', value: '...'} ] // One element's locators
                ]
            }
            */

            page.locators.forEach((elementLocators, index) => { // elementLocators is Array of locators
                const row = document.createElement('tr');
                row.innerHTML = `<td>${index + 1}</td>`;

                const checkedTypes = LocatorX.filters.getCheckedTypes();
                checkedTypes.forEach(type => {
                    const matching = elementLocators.find(l => l.type === type);
                    const val = matching ? matching.locator : '-';
                    row.innerHTML += `<td class="editable">${val}</td>`;
                });

                row.innerHTML += `<td><i class="bi-clipboard" title="Copy"></i><i class="bi-trash" title="Delete"></i></td>`;
                tbody.appendChild(row);
            });
        },

        deleteLocator(row) {
            // row ends up being the TR.
            // But we need the index relative to the body, or we can rely on rowIndex (minus header).
            const tbody = row.parentElement;
            const index = Array.from(tbody.children).indexOf(row);

            if (index === -1) return;

            const page = this.getCurrentPage();
            if (page && page.locators) {
                page.locators.splice(index, 1);
                LocatorX.core.savePOMPage(page);
                this.renderTable(page.id);
            }
        }
    },

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

                // Init POM if needed
                if (!LocatorX.pom.currentPageId) {
                    LocatorX.pom.init();
                } else {
                    // re-render in case filter changed
                    LocatorX.pom.renderTable(LocatorX.pom.currentPageId);
                }
            }
            this.current = tab;

            // Sync Inspect Mode if active
            if (LocatorX.inspect && LocatorX.inspect.isActive) {
                LocatorX.inspect.currentMode = tab;
                LocatorX.inspect.updateUI();
            }
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
        rotation: 0,

        init() {
            this.load();
            document.getElementById('themeBtn').addEventListener('click', () => this.toggle());
        },

        toggle() {
            this.current = this.current === 'light' ? 'dark' : 'light';
            this.rotation += 180;
            document.getElementById('themeBtn').style.transform = `rotate(${this.rotation}deg)`;
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
                if (e.target && e.target.closest && !e.target.closest('.nav-item')) this.closeAll();
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
        lastLocators: null,
        lastLocatorTime: 0,

        init() {
            this.setupSelectAll();
            this.setupCheckboxes();
            this.setupRelativeXPath();
            this.setupScopeSwitch();
            this.loadFiltersFromStorage();
            this.saveCurrentFilters('home');
            this.updateTable();
        },

        loadFiltersFromStorage() {
            chrome.storage.local.get(['enabledFilters'], (result) => {
                if (result.enabledFilters && result.enabledFilters.length > 0) {
                    // Set checkboxes based on stored filters
                    document.querySelectorAll('.loc-type, .nested-loc-type').forEach(cb => {
                        cb.checked = result.enabledFilters.includes(cb.id);
                    });
                    this.updateNestedIcon();
                }
            });
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

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

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

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

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

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

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
            const enabledIds = this.getEnabledFilterIds();

            // Save enabled filters to storage
            chrome.storage.local.set({ enabledFilters: enabledIds });

            tbody.innerHTML = '';

            // If we have actual captured data, show that
            if (this.lastLocators && this.lastLocators.length > 0) {
                this.renderHomeTable(this.lastLocators);
            } else {
                // Otherwise show "structural" empty rows for enabled filters
                const checkedTypes = this.getCheckedTypes();
                checkedTypes.forEach(type => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><span class="match-count match-none">-</span></td>
                        <td>${type}</td>
                        <td class="editable" style="color: var(--secondary-text); opacity: 0.5;">-</td>
                        <td>
                            <i class="bi-clipboard disabled" title="Copy"></i>
                            <i class="bi-bookmark-plus disabled" title="Save"></i>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }

            this.updatePOMTable();
        },

        renderHomeTable(locators) {
            const tbody = document.querySelector('.home-container .locator-table tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            locators.forEach(locator => {
                const matchClass = locator.matches === 0 ? 'match-none' :
                    locator.matches === 1 ? 'match-single' : 'match-multiple';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="match-count ${matchClass}">${locator.matches}</span></td>
                    <td>${locator.type}</td>
                    <td class="editable">${locator.locator}</td>
                    <td>
                        <i class="bi-clipboard" title="Copy"></i>
                        <i class="bi-bookmark-plus" title="Save"></i>
                    </td>
                `;
                tbody.appendChild(row);
            });
        },

        displayGeneratedLocators(locators, elementInfo = null) {
            // Check for duplicate (same locators within 500ms)
            const now = Date.now();
            if (this.lastLocators &&
                (now - this.lastLocatorTime < 500) &&
                JSON.stringify(this.lastLocators) === JSON.stringify(locators)) {
                return;
            }
            this.lastLocators = locators;
            this.lastLocatorTime = now;

            if (LocatorX.tabs.current === 'home') {
                this.renderHomeTable(locators);

                // Update element detail
                const detailEl = document.getElementById('homeElementDetail');
                if (detailEl && elementInfo) {
                    detailEl.textContent = elementInfo;
                }
            } else if (LocatorX.tabs.current === 'pom') {
                // Check if page selected
                let currentPage = LocatorX.pom.getCurrentPage();

                // Auto-create page if none exists or none selected
                if (!currentPage) {
                    LocatorX.modal.prompt(
                        'Create First Page',
                        'Page 1',
                        'No pages exist yet. Enter a name to create your first POM page:'
                    )
                        .then(name => {
                            if (name) {
                                // Create page manually to get the ID and object
                                const newPage = {
                                    id: `pom_${Date.now()}`,
                                    name: name,
                                    locators: []
                                };
                                LocatorX.core.savePOMPage(newPage);
                                LocatorX.pom.loadPages();
                                LocatorX.pom.switchPage(newPage.id);
                                currentPage = newPage;

                                // Now add the locators
                                this.addLocatorsToPage(currentPage, locators);
                            }
                        });
                    return;
                }

                this.addLocatorsToPage(currentPage, locators);
            }
        },

        addLocatorsToPage(page, locators) {
            const tbody = document.querySelector('.pom-content .pom-table tbody');
            if (!tbody) return;

            // Check for duplicates (existing logic)
            /* The existing logic reads from DOM which is fine for visual duplicates, 
               but we should check the data model */
            const isDuplicate = page.locators.some(l => JSON.stringify(l) === JSON.stringify(locators));
            if (isDuplicate) {
                LocatorX.notifications.warning(`Already added to "${page.name}"`);
                return;
            }

            // Add to storage
            page.locators.push(locators);
            LocatorX.core.savePOMPage(page);

            // Re-render
            LocatorX.pom.renderTable(page.id);
        },

        getEnabledFilterIds() {
            const enabledIds = [];
            const checkboxes = document.querySelectorAll('.loc-type:checked, .nested-loc-type:checked');
            checkboxes.forEach(cb => enabledIds.push(cb.id));
            return enabledIds;
        },

        updatePOMTable() {
            const pomTable = document.querySelector('.pom-table');
            if (!pomTable) return;

            const checkedTypes = this.getCheckedTypes();

            // If we are in POM mode and have a page, re-render it
            if (LocatorX.tabs.current === 'pom' && LocatorX.pom.currentPageId) {
                LocatorX.pom.renderTable(LocatorX.pom.currentPageId);
            }

            // Header update is still needed
            const headermain = pomTable.querySelector('thead tr');
            if (headermain) {
                const checkedTypes = this.getCheckedTypes();
                headermain.innerHTML = '<th>#</th>';
                checkedTypes.forEach(type => {
                    headermain.innerHTML += `<th>${type}</th>`;
                });
                headermain.innerHTML += '<th>Actions</th>';
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
                if (!e.target || !e.target.closest || !e.target.closest('.relative-xpath-container')) {
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

    dependencies: {
        init() {
            const framework = document.getElementById('frameworkSelect');

            if (framework) {
                framework.addEventListener('change', e => {
                    this.updateDisplay('frameworkDisplay', e.target.value);
                    LocatorX.filters.updateFiltersForDependencies();
                });
                this.updateDisplay('frameworkDisplay', framework.value);
            }
        },

        updateDisplay(displayId, value) {
            const display = document.getElementById(displayId);
            if (display) display.textContent = value;
        }
    },

    // Search Suggestions
    search: {
        suggestions: [
            // XPath Axes
            { type: 'ancestor::', value: 'ancestor::' },
            { type: 'ancestor-or-self::', value: 'ancestor-or-self::' },
            { type: 'attribute::', value: 'attribute::' },
            { type: 'child::', value: 'child::' },
            { type: 'descendant::', value: 'descendant::' },
            { type: 'descendant-or-self::', value: 'descendant-or-self::' },
            { type: 'following::', value: 'following::' },
            { type: 'following-sibling::', value: 'following-sibling::' },
            { type: 'parent::', value: 'parent::' },
            { type: 'preceding::', value: 'preceding::' },
            { type: 'preceding-sibling::', value: 'preceding-sibling::' },
            { type: 'self::', value: 'self::' },

            // XPath Functions
            { type: 'contains()', value: 'contains()' },
            { type: 'text()', value: 'text()' },
            { type: 'starts-with()', value: 'starts-with()' },
            { type: 'ends-with()', value: 'ends-with()' },
            { type: 'normalize-space()', value: 'normalize-space()' },
            { type: 'last()', value: 'last()' },
            { type: 'position()', value: 'position()' },
            { type: 'count()', value: 'count()' },
            { type: 'not()', value: 'not()' },
            { type: 'string-length()', value: 'string-length()' },
            { type: 'substring()', value: 'substring()' },
            { type: 'translate()', value: 'translate()' },
            { type: 'floor()', value: 'floor()' },
            { type: 'ceiling()', value: 'ceiling()' },
            { type: 'round()', value: 'round()' },

            // Operators
            { type: 'and', value: 'and' },
            { type: 'or', value: 'or' },
            { type: 'mod', value: 'mod' },
            { type: 'div', value: 'div' },
            { type: '//', value: '//' },
            { type: '/', value: '/' },
            { type: '*', value: '*' },
            { type: '|', value: '|' },
            { type: '!=', value: '!=' },

            // Common Attributes
            { type: '@id', value: '@id' },
            { type: '@class', value: '@class' },
            { type: '@name', value: '@name' },
            { type: '@type', value: '@type' },
            { type: '@href', value: '@href' },
            { type: '@src', value: '@src' },
            { type: '@value', value: '@value' },
            { type: '@title', value: '@title' },
            { type: '@alt', value: '@alt' },
            { type: '@placeholder', value: '@placeholder' },
            { type: '@style', value: '@style' },
            { type: '@data-testid', value: '@data-testid' },
            { type: '@role', value: '@role' },
            { type: '@aria-label', value: '@aria-label' },

            // HTML Tags
            { type: 'div', value: 'div' },
            { type: 'span', value: 'span' },
            { type: 'a', value: 'a' },
            { type: 'input', value: 'input' },
            { type: 'button', value: 'button' },
            { type: 'form', value: 'form' },
            { type: 'img', value: 'img' },
            { type: 'label', value: 'label' },
            { type: 'select', value: 'select' },
            { type: 'option', value: 'option' },
            { type: 'textarea', value: 'textarea' },
            { type: 'ul', value: 'ul' },
            { type: 'li', value: 'li' },
            { type: 'ol', value: 'ol' },
            { type: 'table', value: 'table' },
            { type: 'tr', value: 'tr' },
            { type: 'td', value: 'td' },
            { type: 'th', value: 'th' },
            { type: 'thead', value: 'thead' },
            { type: 'tbody', value: 'tbody' },
            { type: 'h1', value: 'h1' },
            { type: 'h2', value: 'h2' },
            { type: 'h3', value: 'h3' },
            { type: 'h4', value: 'h4' },
            { type: 'h5', value: 'h5' },
            { type: 'h6', value: 'h6' },
            { type: 'p', value: 'p' },
            { type: 'nav', value: 'nav' },
            { type: 'header', value: 'header' },
            { type: 'footer', value: 'footer' },
            { type: 'section', value: 'section' },
            { type: 'article', value: 'article' },
            { type: 'aside', value: 'aside' },
            { type: 'main', value: 'main' },
            { type: 'iframe', value: 'iframe' },
            { type: 'svg', value: 'svg' },
            { type: 'path', value: 'path' }
        ],
        selectedIndex: -1,

        init() {
            const input = document.getElementById('searchInput');
            const dropdown = document.getElementById('searchDropdown');

            if (input && dropdown) {
                input.addEventListener('input', () => this.handleInput(input, dropdown));
                input.addEventListener('keydown', (e) => this.handleKeydown(e, input, dropdown));
                input.addEventListener('blur', () => {
                    setTimeout(() => {
                        dropdown.classList.remove('visible');
                        setTimeout(() => dropdown.style.display = 'none', 150);
                    }, 200);
                });
                input.addEventListener('focus', () => {
                    if (input.value.length > 0) {
                        this.handleInput(input, dropdown);
                    }
                });
            }
        },

        handleInput(input, dropdown) {
            const value = input.value.toLowerCase();
            if (value.length === 0) {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
                return;
            }

            const matches = this.suggestions.filter(s =>
                s.value.toLowerCase().includes(value) ||
                s.type.toLowerCase().includes(value)
            );

            if (matches.length > 0) {
                this.renderDropdown(matches, value, dropdown);
                dropdown.style.display = 'block';
                // Force reflow
                dropdown.offsetHeight;
                dropdown.classList.add('visible');
            } else {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
            }

            this.selectedIndex = -1;
        },

        renderDropdown(matches, query, dropdown) {
            dropdown.innerHTML = '';
            matches.forEach((match, index) => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.setAttribute('role', 'option');
                div.setAttribute('aria-selected', 'false');

                // Highlight matching part
                const text = match.type;
                const lowerText = text.toLowerCase();
                const queryIndex = lowerText.indexOf(query);

                let html = '';
                if (queryIndex >= 0) {
                    html = text.substring(0, queryIndex) +
                        '<strong>' + text.substring(queryIndex, queryIndex + query.length) + '</strong>' +
                        text.substring(queryIndex + query.length);
                } else {
                    html = text;
                }

                div.innerHTML = `
                    <i class="bi-search item-icon"></i>
                    <span>${html}</span>
                `;

                div.addEventListener('click', () => {
                    const input = document.getElementById('searchInput');
                    input.value = match.type;
                    dropdown.classList.remove('visible');
                    dropdown.style.display = 'none';
                    input.focus();
                });

                div.addEventListener('mouseenter', () => {
                    this.selectedIndex = index;
                    this.updateSelection(dropdown);
                });

                dropdown.appendChild(div);
            });
        },

        handleKeydown(e, input, dropdown) {
            if (!dropdown.classList.contains('visible')) return;

            const items = dropdown.querySelectorAll('.dropdown-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % items.length;
                this.updateSelection(dropdown);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
                this.updateSelection(dropdown);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    items[this.selectedIndex].click();
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
            }
        },

        updateSelection(dropdown) {
            const items = dropdown.querySelectorAll('.dropdown-item');
            items.forEach((item, index) => {
                if (index === this.selectedIndex) {
                    item.classList.add('active');
                    item.setAttribute('aria-selected', 'true');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('active');
                    item.setAttribute('aria-selected', 'false');
                }
            });
        }
    },

    // Inspect Button Management
    inspect: {
        isActive: false,
        currentMode: 'home',

        init() {
            const inspectBtn = document.getElementById('inspectBtn');
            if (inspectBtn) {
                inspectBtn.addEventListener('click', () => this.toggle());
                // Right-click to turn off inspect mode for both home and POM
                inspectBtn.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (this.isActive) {
                        this.deactivate();
                    }
                });
            }

            // Listen for messages from content script
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'locatorsGenerated') {
                    LocatorX.filters.displayGeneratedLocators(message.locators, message.elementInfo);
                    // Auto-deactivate picking in Home mode after successful capture
                    if (LocatorX.tabs.current === 'home') {
                        this.deactivate();
                    }
                } else if (message.action === 'deactivateInspect') {
                    // Handle ESC key and right-click deactivation from content script
                    this.deactivate();
                }
            });
        },

        toggle() {
            if (!SiteSupport.isSupported) return;
            if (this.isActive) {
                this.deactivate();
            } else {
                this.activate();
            }
        },

        activate() {
            this.isActive = true;
            this.currentMode = LocatorX.tabs.current;

            this.updateUI();

            // Send message to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
                    chrome.tabs.sendMessage(tab.id, { action: 'startScanning' }).catch(() => { });
                }
            });
        },

        deactivate() {
            this.isActive = false;
            this.updateUI();

            // Send message to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'stopScanning' }).catch(() => { });
                }
            });
        },

        updateUI() {
            const inspectBtn = document.getElementById('inspectBtn');
            if (!inspectBtn) return;

            if (!SiteSupport.isSupported) {
                inspectBtn.className = 'bi-arrow-up-left-circle inspect-button header-icon-button disabled';
                inspectBtn.style.animation = 'none';
                inspectBtn.style.color = '';
                return;
            }

            if (this.isActive) {
                inspectBtn.className = 'bi-arrow-up-left-circle-fill inspect-button header-icon-button';
                if (this.currentMode === 'home') {
                    inspectBtn.style.animation = 'pulse-green 2s infinite';
                    inspectBtn.style.color = '#28a745';
                } else {
                    inspectBtn.style.animation = 'pulse-red 2s infinite';
                    inspectBtn.style.color = '#dc3545';
                }
            } else {
                inspectBtn.className = 'bi-arrow-up-left-circle inspect-button header-icon-button';
                inspectBtn.style.animation = 'none';
                inspectBtn.style.color = '';
            }
        }
    },

    // Initialize all modules
    async init() {
        this.core = new LocatorXCore();
        await this.core.initialize();

        this.modal = new LocatorXModal();
        this.tabs.init();
        this.theme.init();
        this.dropdowns.init();
        this.filters.init();
        this.dependencies.init();
        this.search.init();
        this.pom.init();
        this.table.init();
        this.savedLocators.init();
        this.notifications.init();
        this.inspect.init();

        // Check site support
        if (typeof SiteSupport !== 'undefined') {
            SiteSupport.check();
        }

        // Establish persistent connection to background for lifecycle management
        chrome.runtime.connect({ name: 'locatorx-panel' });
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
            this.setupSavedActions();
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
            }

            // Always setup actions after updating content
            this.setupSavedActions();
        },

        setupSavedActions() {
            // Use event delegation on the dropdown container
            const dropdown = document.getElementById('aboutDropdown');
            if (!dropdown) return;

            // Remove existing listener
            dropdown.removeEventListener('click', this.handleSavedClick);

            // Add new listener with proper binding
            this.handleSavedClick = (e) => {
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
            };

            dropdown.addEventListener('click', this.handleSavedClick);
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
                                name = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
                                    name = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
                            name = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
                if (!e.target || !e.target.closest) return;

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
                    const savedName = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');

                    const isDuplicate = saved.some(item => item.locator === locator && item.type === type);

                    if (isDuplicate) {
                        LocatorX.notifications.warning('Locator already saved');
                        return;
                    }

                    saved.push({ name: savedName, type, locator, date: new Date().toISOString() });
                    localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                    LocatorX.savedLocators.updateDropdown();
                    LocatorX.notifications.success(`Locator saved as "${savedName}"`);
                }
                if (e.target.classList.contains('bi-trash')) {
                    const row = e.target.closest('tr');
                    if (row.closest('.pom-table')) {
                        LocatorX.pom.deleteLocator(row);
                    } else {
                        row.remove();
                        this.updateRowNumbers();
                    }
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
            let clickCount = 0;
            let clickTimeout;

            document.addEventListener('click', (e) => {
                if (!e.target || !e.target.classList) return;

                if (e.target.classList.contains('editable') && !e.target.classList.contains('editing')) {
                    clickCount++;

                    if (clickCount === 1) {
                        clickTimeout = setTimeout(() => {
                            // Single click - highlight in search
                            const locator = e.target.textContent;
                            const searchInput = document.querySelector('.search-input');
                            if (searchInput) {
                                searchInput.value = locator;
                                searchInput.focus();
                            }
                            clickCount = 0;
                        }, 300);
                    } else if (clickCount === 2) {
                        // Double click - make editable
                        clearTimeout(clickTimeout);
                        this.makeEditable(e.target);
                        clickCount = 0;
                    }
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

// Initialize the application with error handling
LocatorX.init().catch(err => {
    console.error('Failed to initialize Locator-X:', err);
});

// Export API for external use
window.LocatorXAPI = {
    switchToHome: () => LocatorX.tabs.switch('home'),
    switchToPOM: () => LocatorX.tabs.switch('pom'),
    getCurrentTab: () => LocatorX.tabs.current,
    toggleTheme: () => LocatorX.theme.toggle(),
    getCurrentTheme: () => LocatorX.theme.current,
    closeAllDropdowns: () => LocatorX.dropdowns.closeAll()
};