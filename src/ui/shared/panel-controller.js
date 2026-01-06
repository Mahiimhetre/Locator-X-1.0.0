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

            page.locators.forEach((item, index) => {
                // Handle legacy data (item is array) vs new data (item is {locators, fingerprint})
                const elementLocators = Array.isArray(item) ? item : item.locators;
                const hasFingerprint = !Array.isArray(item) && item.fingerprint;

                const row = document.createElement('tr');
                row.innerHTML = `<td>${index + 1}</td>`;

                const checkedTypes = LocatorX.filters.getCheckedTypes();
                const groupedTypes = ['Relative XPath', 'Contains XPath', 'Indexed XPath', 'Link Text XPath', 'Partial Link XPath', 'Attribute XPath', 'CSS XPath'];

                // Split types into standards and grouped
                const renderColumns = [];
                let hasGroupedColumn = false;

                checkedTypes.forEach(type => {
                    if (groupedTypes.includes(type)) {
                        hasGroupedColumn = true;
                    } else {
                        renderColumns.push(type);
                    }
                });

                // Render Standard Columns
                renderColumns.forEach(type => {
                    const matching = elementLocators.find(l => l.type === type);
                    const val = matching ? matching.locator : '-';
                    row.innerHTML += `<td class="editable">${val}</td>`;
                });

                // Render Grouped Column (Relative XPath) if needed
                // Render Grouped Column (Relative XPath) if needed
                if (hasGroupedColumn) {
                    // Get ALL enabled grouped types (not just generated ones)
                    const enabledGrouped = checkedTypes.filter(t => groupedTypes.includes(t));

                    if (enabledGrouped.length > 0) {
                        // Find which locators actually exist
                        const validGrouped = elementLocators.filter(l => groupedTypes.includes(l.type));

                        // Select Preferred: 
                        // 1. 'Relative XPath' if valid
                        // 2. First valid
                        // 3. Fallback to 'Relative XPath' or first enabled
                        let preferredType = '';
                        const relativeFn = validGrouped.find(l => l.type === 'Relative XPath');

                        if (relativeFn) {
                            preferredType = 'Relative XPath';
                        } else if (validGrouped.length > 0) {
                            preferredType = validGrouped[0].type;
                        } else {
                            preferredType = enabledGrouped.includes('Relative XPath') ? 'Relative XPath' : enabledGrouped[0];
                        }

                        const preferredLocatorFn = elementLocators.find(l => l.type === preferredType);
                        const preferredValue = preferredLocatorFn ? preferredLocatorFn.locator : '-';

                        // create dropdown options
                        const options = enabledGrouped.map(type => {
                            const loc = elementLocators.find(l => l.type === type);
                            const val = loc ? loc.locator : '-';
                            const isDisabled = !loc;
                            return `<option value="${type}" data-locator="${val}" ${type === preferredType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${type}</option>`;
                        }).join('');

                        row.innerHTML += `
                            <td class="strategy-cell">
                                <div class="pom-strategy-container">
                                     <select class="strategy-dropdown pom-strategy-select">
                                        ${options}
                                     </select>
                                     <div class="strategy-value editable">${preferredValue}</div>
                                </div>
                            </td>`;
                    } else {
                        row.innerHTML += `<td class="editable" style="color: var(--secondary-text); opacity: 0.5;">-</td>`;
                    }
                }

                const healBtn = hasFingerprint
                    ? `<i class="bi-bandaid heal-btn" title="Heal Locator" style="color: var(--status-green); cursor: pointer; margin-right: 6px;"></i>`
                    : `<i class="bi-bandaid" title="Missing Fingerprint" style="color: var(--border-light); cursor: not-allowed; margin-right: 6px;"></i>`;

                row.innerHTML += `<td>
                    ${healBtn}
                    <i class="bi-clipboard" title="Copy"></i>
                    <i class="bi-trash" title="Delete"></i>
                </td>`;

                // Bind Events
                if (hasGroupedColumn) {
                    const select = row.querySelector('.pom-strategy-select');
                    if (select) {
                        select.addEventListener('change', (e) => {
                            const newType = e.target.value;
                            const newValue = elementLocators.find(l => l.type === newType);
                            if (newValue) {
                                const valDiv = row.querySelector('.strategy-value');
                                if (valDiv) valDiv.textContent = newValue.locator;
                            }
                        });
                    }
                }

                // Bind Heal Event
                if (hasFingerprint) {
                    const btn = row.querySelector('.heal-btn');
                    if (btn) {
                        btn.addEventListener('click', () => {
                            this.healLocator(item, row);
                        });
                    }
                }

                tbody.appendChild(row);
            });
        },

        async healLocator(item, row) {
            const btn = row.querySelector('.bi-bandaid');
            if (btn) {
                btn.className = 'bi-arrow-repeat spin-anim'; // Spin icon
            }

            LocatorX.notifications.info('Attempting to heal locator...');

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'healLocator',
                        fingerprint: item.fingerprint
                    }, (response) => {
                        // Restore icon
                        if (btn) btn.className = 'bi-bandaid heal-btn';

                        if (chrome.runtime.lastError || !response || !response.success) {
                            LocatorX.notifications.error('Healing failed: ' + (response?.error || 'Unknown error'));
                            return;
                        }

                        // Success!
                        const match = response.match; // { score, text, tagName }
                        const newLocators = response.locators;
                        const duration = response.duration;

                        LocatorX.notifications.success(`Healed in ${duration}ms (Score: ${Math.round(match.score)})`);

                        // Ask user to update
                        LocatorX.modal.confirm(
                            'Heal Successful',
                            `Found match (Score: ${Math.round(match.score)})<br>
                             Tag: <b>${match.tagName}</b><br>
                             Text: "${match.text}"<br><br>
                             reasons: ${match.reasons.join(', ')}<br><br>
                             <b>Update stored locators?</b>`,
                            { icon: 'bi-bandaid-fill' }
                        ).then(confirmed => {
                            if (confirmed) {
                                // Update item in storage
                                item.locators = newLocators; // Update locators
                                // Fingerprint usually stays same or update it too? 
                                // Ideally update fingerprint to the NEW element's state so future healing is accurate to the NEW state.
                                // But response doesn't give full fingerprint back currently, only partial info + locators.
                                // Let's keep old fingerprint or better yet, ask scanner to return new fingerprint.
                                // For now, just update locators.

                                const page = this.getCurrentPage();
                                LocatorX.core.savePOMPage(page);
                                this.renderTable(page.id);
                            }
                        });
                    });
                }
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
            // Prevent switching if inspection is active
            if (LocatorX.inspect.isActive) {
                LocatorX.notifications.error('Please stop inspection before switching tabs.');
                return;
            }

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
            { btn: 'navSettings', dropdown: 'settingsDropdown' },
            { btn: 'userDropdownTrigger', dropdown: 'userDropdown' }
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
                // Modified to include user-profile in the exception list
                if (e.target && e.target.closest &&
                    !e.target.closest('.nav-item') &&
                    !e.target.closest('.user-profile')) {
                    this.closeAll();
                }
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
        lastElementInfo: null,
        lastElementType: null,
        lastFingerprint: null,

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
                        cb.checked = selectAll.checked;
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
            // If we have actual captured data, show that
            if (this.lastLocators && this.lastLocators.length > 0) {
                this.renderHomeTable(this.lastLocators);

                // Restore detail and badge
                const detailEl = document.getElementById('homeElementDetail');
                if (detailEl && this.lastElementInfo) {
                    detailEl.textContent = this.lastElementInfo;
                }

                const badge = document.getElementById('elementTypeBadge');
                if (badge) {
                    if (this.lastElementType) {
                        badge.textContent = this.lastElementType;
                        badge.setAttribute('data-type', this.lastElementType);
                        badge.classList.remove('hidden');
                    } else {
                        badge.classList.add('hidden');
                    }
                }
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

            const checkedTypes = this.getCheckedTypes();
            const groupedTypes = [
                'Relative XPath', 'Contains XPath', 'Indexed XPath',
                'Link Text XPath', 'Partial Link XPath',
                'Attribute XPath', 'CSS XPath'
            ];

            const standardTypes = checkedTypes.filter(t => !groupedTypes.includes(t));
            const activeGroupedTypes = checkedTypes.filter(t => groupedTypes.includes(t));

            tbody.innerHTML = '';

            // 1. Render Standard Types (ID, Name, CSS, etc.)
            standardTypes.forEach(type => {
                const locator = locators.find(l => l.type === type);
                this.renderRow(tbody, type, locator);
            });

            // 2. Render Grouped Types (Strategies Dropdown)
            if (activeGroupedTypes.length > 0) {
                // Determine which strategy to show initially
                // Default to 'Relative XPath' if present, otherwise first available
                let currentType = activeGroupedTypes.includes('Relative XPath')
                    ? 'Relative XPath'
                    : activeGroupedTypes[0];

                const locator = locators.find(l => l.type === currentType);
                this.renderGroupRow(tbody, activeGroupedTypes, currentType, locators);
            }
        },

        renderRow(tbody, type, locator) {
            const row = document.createElement('tr');
            if (locator) {
                const matchClass = locator.matches === 0 ? 'match-none' :
                    locator.matches === 1 ? 'match-single' : 'match-multiple';

                row.innerHTML = `
                    <td><span class="match-count ${matchClass}">${locator.matches}</span></td>
                    <td>${locator.type}</td>
                    <td class="editable">${locator.locator}</td>
                    <td>
                        <i class="bi-clipboard" title="Copy"></i>
                        <i class="bi-bookmark-plus" title="Save"></i>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td><span class="match-count match-none">-</span></td>
                    <td>${type}</td>
                    <td class="editable" style="color: var(--secondary-text); opacity: 0.5;">-</td>
                    <td>
                        <i class="bi-clipboard disabled" title="Copy"></i>
                        <i class="bi-bookmark-plus disabled" title="Save"></i>
                    </td>
                `;
            }
            tbody.appendChild(row);
        },

        renderGroupRow(tbody, availableTypes, currentType, allLocators) {
            const locator = allLocators.find(l => l.type === currentType);
            const row = document.createElement('tr');
            row.className = 'strategy-row';

            // Match Count
            const matchCount = locator ? locator.matches : '-';
            const matchClass = !locator ? 'match-none' :
                (locator.matches === 0 ? 'match-none' :
                    locator.matches === 1 ? 'match-single' : 'match-multiple');

            // Dropdown Options
            const options = availableTypes.map(type => {
                const typeLocator = allLocators.find(l => l.type === type);
                const isDisabled = !typeLocator;
                return `<option value="${type}" ${type === currentType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${type}${isDisabled ? '' : ''}</option>`;
            }).join('');

            const locatorValue = locator ? locator.locator : '-';
            const locatorStyle = locator ? '' : 'style="color: var(--secondary-text); opacity: 0.5;"';
            const actionClass = locator ? '' : 'disabled';

            row.innerHTML = `
                <td><span class="match-count ${matchClass}" id="strategyMatchCount">${matchCount}</span></td>
                <td class="strategy-cell">
                    <select class="strategy-dropdown" id="strategySelect">
                        ${options}
                    </select>
                </td>
                <td class="editable" id="strategyLocator" ${locatorStyle}>${locatorValue}</td>
                <td>
                    <i class="bi-clipboard ${actionClass}" title="Copy"></i>
                    <i class="bi-bookmark-plus ${actionClass}" title="Save"></i>
                </td>
            `;

            tbody.appendChild(row);

            // Add Event Listener for Dropdown
            const select = row.querySelector('#strategySelect');
            if (select) {
                select.addEventListener('change', (e) => {
                    const newType = e.target.value;
                    const newLocator = allLocators.find(l => l.type === newType);
                    this.updateGroupRow(row, newType, newLocator);
                });
            }
        },

        updateGroupRow(row, type, locator) {
            const matchBadge = row.querySelector('#strategyMatchCount');
            const locatorCell = row.querySelector('#strategyLocator');
            const actions = row.querySelectorAll('.bi-clipboard, .bi-bookmark-plus');

            if (locator) {
                matchBadge.textContent = locator.matches;
                matchBadge.className = `match-count ${locator.matches === 0 ? 'match-none' : locator.matches === 1 ? 'match-single' : 'match-multiple'}`;

                locatorCell.textContent = locator.locator;
                locatorCell.style.color = '';
                locatorCell.style.opacity = '1';

                actions.forEach(btn => btn.classList.remove('disabled'));
            } else {
                matchBadge.textContent = '-';
                matchBadge.className = 'match-count match-none';

                locatorCell.textContent = '-';
                locatorCell.style.color = 'var(--secondary-text)';
                locatorCell.style.opacity = '0.5';

                actions.forEach(btn => btn.classList.add('disabled'));
            }
        },

        displayGeneratedLocators(locators, elementInfo = null, elementType = null, fingerprint = null, metadata = null) {
            // Check for duplicate (same locators within 500ms)
            const now = Date.now();
            if (this.lastLocators &&
                (now - this.lastLocatorTime < 500) &&
                JSON.stringify(this.lastLocators) === JSON.stringify(locators)) {
                return;
            }
            this.lastLocators = locators;
            this.lastLocatorTime = now;
            this.lastElementInfo = elementInfo;
            this.lastElementType = elementType;
            this.lastFingerprint = fingerprint;
            this.lastMetadata = metadata;

            if (LocatorX.tabs.current === 'home') {
                this.renderHomeTable(locators);
                this.updateElementInfo(elementInfo, elementType, metadata);
            } else if (LocatorX.tabs.current === 'pom') {
                this.handlePOMDisplay(locators, fingerprint);
            }
        },

        updateElementInfo(info, type, metadata = null) {
            // Update detail text if available
            const detailText = document.getElementById('homeElementDetail');
            if (detailText) {
                if (metadata && metadata.isCrossOrigin) {
                    detailText.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">[Security Warning]</span> Element is inside a cross-origin iframe. Browser security blocks access. <br/> <small style="opacity: 0.7;">Only the iframe selector itself can be captured.</small>`;
                } else {
                    detailText.textContent = info || 'No element selected';
                }
            }

            // Update Element Type Badge
            const badge = document.getElementById('elementTypeBadge');
            if (badge) {
                let displayType = type;
                if (metadata && metadata.isInIframe) {
                    displayType = metadata.isCrossOrigin ? 'Iframe (Cross-Origin)' : 'Iframe (Captured)';
                }

                if (displayType && displayType !== 'Normal') {
                    badge.textContent = displayType;
                    badge.setAttribute('data-type', displayType);
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        },

        handlePOMDisplay(locators, fingerprint) {
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
                            this.addLocatorsToPage(currentPage, locators, fingerprint);
                        }
                    });
                return;
            }

            this.addLocatorsToPage(currentPage, locators, fingerprint);
            this.updatePOMTable();
        },



        addLocatorsToPage(page, locators, fingerprint) {
            const tbody = document.querySelector('.pom-content .pom-table tbody');
            if (!tbody) return;

            // Check for duplicates (existing logic)
            // Handle both legacy (array) and new (object) structure
            const isDuplicate = page.locators.some(l => {
                const existingLocators = Array.isArray(l) ? l : l.locators;
                return JSON.stringify(existingLocators) === JSON.stringify(locators);
            });

            if (isDuplicate) {
                LocatorX.notifications.warning(`Already added to "${page.name}"`);
                return;
            }

            // Add to storage with fingerprint
            page.locators.push({ locators, fingerprint });
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
                const standardTypes = [];
                let hasRelativeXPath = false;

                const groupedTypes = ['Relative XPath', 'Contains XPath', 'Indexed XPath', 'Link Text XPath', 'Partial Link XPath', 'Attribute XPath', 'CSS XPath'];

                checkedTypes.forEach(type => {
                    if (groupedTypes.includes(type)) {
                        hasRelativeXPath = true;
                    } else {
                        standardTypes.push(type);
                    }
                });

                headermain.innerHTML = '<th>#</th>';
                standardTypes.forEach(type => {
                    headermain.innerHTML += `<th>${type}</th>`;
                });

                if (hasRelativeXPath) {
                    headermain.innerHTML += '<th>Relative XPath</th>';
                }

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
                'linkTextLocator': 'Link Text',
                'pLinkTextLocator': 'Partial Link Text',
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
                    'xpathLocator': 'Relative XPath',
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

    settings: {
        init() {
            const resetBtn = document.getElementById('resetSettingsBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.resetToDefaults());
            }
        },

        async resetToDefaults() {
            const confirmed = await LocatorX.modal.confirm(
                'Reset Settings',
                'Are you sure you want to reset all settings to their defaults?',
                { icon: 'bi-arrow-counterclockwise', confirmText: 'Reset', confirmClass: 'lx-yes' }
            );

            if (!confirmed) return;

            // 1. Reset Framework to Selenium
            const frameworkSelect = document.getElementById('frameworkSelect');
            if (frameworkSelect) {
                frameworkSelect.value = 'selenium';
                // Trigger change event to update dependencies display and filters availability
                frameworkSelect.dispatchEvent(new Event('change'));
            }

            // 2. Check all AVAILABLE checkboxes (respecting the framework constraints)
            // The change event above invalidates disabled states, so we can select non-disabled ones
            const checkboxes = document.querySelectorAll('.loc-type:not(:disabled), .nested-loc-type:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = true);

            // Update parent checkboxes state
            const selectAll = document.getElementById('locTypeAll');
            if (selectAll) selectAll.checked = true;

            const relativeXPath = document.getElementById('relativeXPath');
            if (relativeXPath && !relativeXPath.disabled) relativeXPath.checked = true;

            LocatorX.filters.updateNestedIcon();

            // 3. Reset Scope to Home
            if (LocatorX.tabs.current !== 'home') {
                LocatorX.tabs.switch('home');
            }

            // 4. Update Storage and Table
            // We save the current "all checked" state
            chrome.storage.local.set({ enabledFilters: LocatorX.filters.getEnabledFilterIds() });

            LocatorX.filters.updateTable();

            // 5. Notification
            LocatorX.notifications.success('Settings reset to defaults');
        }
    },

    // Search Suggestions
    search: {
        manager: new SuggestionManager(),
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

        async handleInput(input, dropdown) {
            const value = input.value.trim();
            if (value.length === 0) {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
                const badge = document.getElementById('searchMatchBadge');
                if (badge) {
                    badge.textContent = '0';
                    badge.classList.remove('match-single', 'match-multiple');
                    badge.classList.add('match-none');
                }
                return;
            }

            // Sync with current DOM structure for truly "related" suggestions
            await this.refreshDOMContext();

            // Use SuggestionManager for precise filtering
            const suggestions = this.manager.getSuggestions(value);

            // Trigger live evaluation (debounced)
            clearTimeout(this.evalTimeout);
            this.evalTimeout = setTimeout(() => {
                this.performEvaluation(value, suggestions, dropdown);
            }, 300);

            this.renderDropdown(suggestions, value, dropdown, null);
            dropdown.style.display = 'block';
            dropdown.offsetHeight;
            dropdown.classList.add('visible');

            this.selectedIndex = -1;
        },

        async refreshDOMContext() {
            return new Promise((resolve) => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (tab && tab.id) {
                        chrome.tabs.sendMessage(tab.id, { action: 'getPageStructure' }, (response) => {
                            if (chrome.runtime.lastError) {
                                // Ignore connection errors (tab might be loading or unsupported)
                                resolve();
                                return;
                            }
                            if (response) {
                                this.manager.updatePageContext(response);
                            }
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        },

        async performEvaluation(query, suggestions, dropdown) {
            const badge = document.getElementById('searchMatchBadge');
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                        let totalCount = 0;
                        let foundResult = false;

                        // Use a counter to track when all frames have responded
                        let respondedFrames = 0;

                        frames.forEach(frame => {
                            chrome.tabs.sendMessage(tab.id, { action: 'evaluateSelector', selector: query }, { frameId: frame.frameId }, (response) => {
                                respondedFrames++;
                                if (chrome.runtime.lastError) {
                                    if (respondedFrames === frames.length) this.finalizeEvaluation(totalCount, suggestions, query, dropdown, badge);
                                    return;
                                }

                                if (response && typeof response.count !== 'undefined') {
                                    totalCount += response.count;

                                    // If this frame found the element(s), and we haven't shown info yet, show it
                                    if (response.count === 1 && !foundResult) {
                                        foundResult = true;
                                        this.updateElementInfo(response.elementInfo, response.elementType);
                                        if (response.locators) {
                                            LocatorX.filters.displayGeneratedLocators(
                                                response.locators,
                                                response.elementInfo,
                                                response.elementType,
                                                response.fingerprint,
                                                response.metadata
                                            );
                                        }
                                    }
                                }

                                if (respondedFrames === frames.length) {
                                    this.finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult);
                                }
                            });
                        });
                    });
                }
            });
        },

        finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult) {
            this.renderDropdown(suggestions, query, dropdown, totalCount);

            if (!foundResult && totalCount !== 1) {
                this.updateElementInfo(null, null);
                LocatorX.filters.displayGeneratedLocators([], null, null, null);
            }

            // Update the new search match badge
            if (badge) {
                badge.textContent = totalCount;
                badge.classList.remove('hidden', 'match-none', 'match-single', 'match-multiple');
                if (totalCount === 0) badge.classList.add('match-none');
                else if (totalCount === 1) badge.classList.add('match-single');
                else badge.classList.add('match-multiple');
            }

            // Trigger highlighting if matches found (in all frames)
            if (totalCount > 0) {
                this.highlightMatchesInAllFrames(query);
            }
        },

        highlightMatchesInAllFrames(query) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                        frames.forEach(frame => {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'highlightMatches',
                                selector: query
                            }, { frameId: frame.frameId }).catch(() => { });
                        });
                    });
                }
            });
        },

        clearMatchHighlightsInAllFrames() {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                        frames.forEach(frame => {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'clearMatchHighlights'
                            }, { frameId: frame.frameId }).catch(() => { });
                        });
                    });
                }
            });
        },

        renderDropdown(matches, query, dropdown, activeMatchCount) {
            dropdown.innerHTML = '';

            // Add "Live Test" item if query looks like a selector
            if (query.length > 2) {
                const liveItem = document.createElement('div');
                liveItem.className = 'dropdown-item live-test-item';
                const countText = typeof activeMatchCount === 'number' ? `${activeMatchCount}` : 'Scanning...';
                liveItem.innerHTML = `
                    <div class="match-count-badge">${countText}</div>
                    <span class="item-text"><strong>${query}</strong></span>
                `;
                liveItem.addEventListener('click', () => {
                    this.performEvaluation(query, matches, dropdown);
                });
                dropdown.appendChild(liveItem);
            }

            matches.forEach((match, index) => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.setAttribute('role', 'option');

                const text = match.type;
                const lowerText = text.toLowerCase();
                const queryIndex = lowerText.indexOf(query.toLowerCase());

                let html = '';
                if (queryIndex >= 0) {
                    html = text.substring(0, queryIndex) +
                        '<strong>' + text.substring(queryIndex, queryIndex + query.length) + '</strong>' +
                        text.substring(queryIndex + query.length);
                } else {
                    html = text;
                }

                // Show match count BEFORE the locator as requested
                // Show match count BEFORE the locator as requested
                // Show category if it's not a standard one
                const categoryInfo = ['Tag', 'ID', 'Class'].includes(match.category)
                    ? ''
                    : `<span class="category-tag">(${match.category})</span> `;

                div.innerHTML = `
                    <div class="match-count-badge">${match.count}</div>
                    <span class="item-text">${categoryInfo}${html}</span>
                `;

                div.addEventListener('click', () => {
                    const input = document.getElementById('searchInput');
                    input.value = match.type;
                    dropdown.classList.remove('visible');
                    dropdown.style.display = 'none';
                    this.handleInput(input, dropdown);
                    input.focus();
                });

                // Add hover highlighting
                div.addEventListener('mouseenter', () => {
                    this.highlightMatchesInAllFrames(match.type);
                });

                div.addEventListener('mouseleave', () => {
                    this.clearMatchHighlightsInAllFrames();
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
                    LocatorX.filters.displayGeneratedLocators(
                        message.locators,
                        message.elementInfo,
                        message.elementType,
                        message.fingerprint,
                        message.metadata
                    );
                    // Auto-deactivate picking in Home mode after successful capture
                    if (LocatorX.tabs.current === 'home') {
                        this.deactivate();
                    }
                } else if (message.action === 'deactivateInspect') {
                    // Handle ESC key and right-click deactivation from content script
                    this.deactivate();
                } else if (message.action === 'notification') {
                    if (message.type === 'success') LocatorX.notifications.success(message.message);
                    else if (message.type === 'error') LocatorX.notifications.error(message.message);
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

            // Broadcast to ALL frames
            this.broadcastActionToTab({ action: 'startScanning' });
        },

        deactivate() {
            this.isActive = false;
            this.updateUI();

            // Broadcast to ALL frames
            this.broadcastActionToTab({ action: 'stopScanning' });
        },

        broadcastActionToTab(payload) {
            chrome.runtime.sendMessage({
                action: 'broadcastToTab',
                payload: payload
            }).catch(() => { });
        },

        updateUI() {
            const inspectBtn = document.getElementById('inspectBtn');
            if (!inspectBtn) return;

            // Reset base classes to ensure clean state
            inspectBtn.className = 'inspect-button header-icon-button';
            inspectBtn.style.animation = 'none';
            inspectBtn.style.color = '';

            if (!SiteSupport.isSupported) {
                inspectBtn.classList.add('bi-arrow-up-left-circle', 'disabled');
                inspectBtn.style.color = 'var(--border-dark)';
                return;
            }

            if (this.isActive) {
                inspectBtn.classList.add('bi-arrow-up-left-circle-fill');

                // Active Pulse Animation based on mode
                if (this.currentMode === 'home') {
                    // Green Pulse for Home (Standard)
                    inspectBtn.style.animation = 'pulse-green 2s infinite';
                    inspectBtn.style.color = '#28a745';
                } else {
                    // Red Pulse for POM (Recording)
                    inspectBtn.style.animation = 'pulse-red 2s infinite';
                    inspectBtn.style.color = '#dc3545';
                }
            } else {
                // Inactive State - Clean
                inspectBtn.classList.add('bi-arrow-up-left-circle');
                inspectBtn.style.color = 'var(--secondary-text)';
            }
        }
    },

    // Authentication Management
    auth: {
        init() {
            this.loginBtn = document.getElementById('loginBtn');
            this.logoutBtn = document.getElementById('logoutBtn');
            this.userProfile = document.getElementById('userProfile');
            this.userAvatar = document.getElementById('userAvatar');
            this.userInitials = document.getElementById('userInitials');
            this.userName = document.getElementById('userName');
            this.userPlan = document.getElementById('userPlan');
            this.headerLogo = document.getElementById('headerLogo');
            this.lastUserState = null;
            this.updateTimeout = null;

            if (this.loginBtn) {
                this.loginBtn.addEventListener('click', () => this.login());
            }
            if (this.logoutBtn) {
                this.logoutBtn.addEventListener('click', () => this.logout());
            }

            // Listen for storage changes (external login or manual logout)
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && (changes.authToken || changes.user)) {
                    this.checkStatus();
                }
            });

            // Listen for broadcast messages from background
            chrome.runtime.onMessage.addListener((message) => {
                if (message.action === 'AUTH_STATE_CHANGED') {
                    this.checkStatus();
                }
            });

            this.checkStatus();
        },

        checkStatus() {
            // Debounce updates to handle rapid storage changes
            if (this.updateTimeout) clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => this._performCheck(), 50);
        },

        async _performCheck() {
            const data = await chrome.storage.local.get(['authToken', 'user']);
            if (data.authToken && data.user) {
                this.showLoggedIn(data.user);
            } else {
                this.showLoggedOut();
            }
        },

        showLoggedIn(user) {
            // State Comparison: Skip if no actual change detected
            const userState = JSON.stringify({
                avatar: user.avatar,
                name: user.name,
                plan: user.plan
            });

            if (this.lastUserState === userState) return;
            this.lastUserState = userState;

            if (this.loginBtn) this.loginBtn.classList.add('hidden');
            if (this.userProfile) {
                this.userProfile.classList.remove('hidden');

                // Update Header Logo based on plan
                if (this.headerLogo) {
                    const plan = (user.plan || 'free').toLowerCase();
                    const logoPath = `../../../assets/icons/${plan}48.png`;
                    if (this.headerLogo.getAttribute('src') !== logoPath) {
                        this.headerLogo.src = logoPath;
                    }
                }

                if (this.userAvatar) {
                    if (user.avatar) {
                        this.userAvatar.classList.remove('hidden');
                        if (this.userInitials) this.userInitials.classList.add('hidden');

                        // Only update .src if it's different to prevent flicker
                        if (this.userAvatar.getAttribute('src') !== user.avatar) {
                            this.userAvatar.src = user.avatar;
                        }
                        // Handle broken image -> Switch to initials
                        this.userAvatar.onerror = () => {
                            this.userAvatar.classList.add('hidden');
                            this._showInitials(user.name);
                        };
                    } else {
                        this.userAvatar.classList.add('hidden');
                        this._showInitials(user.name);
                    }
                }
                if (this.userName && this.userName.textContent !== (user.name || 'User')) {
                    this.userName.textContent = user.name || 'User';
                }
                const planText = (user.plan || 'Free').toUpperCase();
                if (this.userPlan && this.userPlan.textContent !== planText) {
                    this.userPlan.textContent = planText;
                }
            }



            // CRITICAL: Update Feature Gates based on user plan
            if (typeof planService !== 'undefined') {
                planService.applyUIGates();
            }
        },

        _showInitials(name) {
            if (!this.userInitials) return;
            this.userInitials.classList.remove('hidden');
            const initial = name ? name.charAt(0).toUpperCase() : '?';
            this.userInitials.textContent = initial;

            // Deterministic background color
            const colors = ['#8e44ad', '#2980b9', '#27ae60', '#d35400', '#c0392b', '#16a085'];
            const charCodeSum = (name || 'User').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            this.userInitials.style.backgroundColor = colors[charCodeSum % colors.length];
        },

        showLoggedOut() {
            if (this.lastUserState === 'loggedOut') return;
            this.lastUserState = 'loggedOut';

            // Reset Header Logo to default
            if (this.headerLogo) {
                this.headerLogo.src = '../../../assets/icons/default48.png';
            }

            if (this.loginBtn) this.loginBtn.classList.remove('hidden');
            if (this.userProfile) this.userProfile.classList.add('hidden');

            // CRITICAL: Revert to Free plan features
            if (typeof planService !== 'undefined') {
                planService.applyUIGates();
            }
        },

        login() {
            // Updated to point to the correct website port
            window.open('http://localhost:3000/auth/login', '_blank');
        },

        logout() {
            chrome.storage.local.remove(['authToken', 'user', 'locator-x-plan'], () => {
                this.checkStatus();
                LocatorX.notifications.success('Logged out successfully');
                // Broadcast logout to ensure other parts update
                chrome.runtime.sendMessage({ action: 'LOGOUT' });
            });
        }
    },

    // Initialize all modules
    async init() {
        this.modal = new LocatorXModal();
        this.core = new LocatorXCore();
        await this.core.initialize();

        if (typeof planService !== 'undefined') {
            await planService.init();
        }

        this.tabs.init();
        this.theme.init();
        this.dropdowns.init();

        if (typeof planService !== 'undefined') {
            planService.applyUIGates(); // Initialize features early to apply gates
        }
        this.filters.init();
        this.dependencies.init();
        this.settings.init();
        this.search.init();
        this.pom.init();
        this.table.init();
        this.savedLocators.init();
        this.notifications.init();
        this.inspect.init();
        this.auth.init();

        // Check site support
        if (typeof SiteSupport !== 'undefined') {
            SiteSupport.init();
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
                                <i class="bi-bookmark-dash" style="font-size: 24px; color: var(--border-dark); margin-bottom: 8px;"></i>
                                <p>No saved locators yet</p>
                            </div>
                        </div>
                    `;
            } else {
                let content = `
                        <div class="dropdown-header">
                            <strong>Saved Locators</strong> <span class="badge-count">${saved.length}</span>
                            <i class="bi-box-arrow-down action-btn header-action" id="exportSavedBtn" title="Export All" data-feature="ui.export" style="margin-left: auto; cursor: pointer;"></i>
                        </div>
                        <div class="dropdown-content">
                    `;

                saved.forEach((item, index) => {
                    const typeClass = item.type ? item.type.toLowerCase().replace(/\s+/g, '-') : 'manual';
                    content += `
                            <div class="saved-item" data-index="${index}">
                                <div class="saved-main">
                                    <div class="saved-info">
                                        <span class="saved-name editable" title="Click to rename">${item.name}</span>
                                        <span class="saved-type-badge ${typeClass}">${item.type}</span>
                                    </div>
                                    <div class="saved-actions">
                                        ${item.fingerprint ? '<button class="action-btn saved-heal" title="Heal"><i class="bi-bandaid" style="color:var(--status-green);"></i></button>' : ''}
                                        <button class="action-btn saved-copy" title="Copy Locator"><i class="bi-clipboard"></i></button>
                                        <button class="action-btn saved-delete" title="Delete"><i class="bi-trash"></i></button>
                                    </div>
                                </div>
                                <div class="saved-locator-code" title="${item.locator}">${item.locator}</div>
                            </div>
                        `;
                });

                content += '</div>';
                dropdown.innerHTML = content;

                // Re-apply feature gates to the new dynamic content
                if (typeof planService !== 'undefined') {
                    planService.applyUIGates();
                }
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
                if (e.target.id === 'exportSavedBtn') {
                    this.exportLocators();
                    return;
                }

                if (e.target.closest('.saved-heal')) {
                    const itemDiv = e.target.closest('.saved-item');
                    const index = parseInt(itemDiv.dataset.index);
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                    const item = saved[index];

                    if (item && item.fingerprint) {
                        const btn = e.target.closest('.saved-heal').querySelector('i');
                        btn.className = 'bi-arrow-repeat spin-anim';

                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            const tab = tabs[0];
                            if (tab && tab.id) {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'healLocator',
                                    fingerprint: item.fingerprint
                                }, (response) => {
                                    btn.className = 'bi-bandaid';
                                    if (chrome.runtime.lastError || !response || !response.success) {
                                        LocatorX.notifications.error('Heal failed');
                                        return;
                                    }

                                    // Suggest update
                                    // For saved locators, we might just update the locator string
                                    // But which strategy? The response returns a list.
                                    // We should ideally pick the same strategy as before if available, or the best one.

                                    const match = response.match;
                                    const best = response.locators.find(l =>
                                        l.type.toLowerCase().includes(item.type.toLowerCase())
                                    ) || response.locators[0]; // Fallback to first

                                    LocatorX.modal.confirm(
                                        'Heal Successful',
                                        `Found match (Score: ${Math.round(match.score)})<br>
                                         New Locator: <b>${best.locator}</b><br>
                                         Update this saved locator?`,
                                        { icon: 'bi-bandaid-fill' }
                                    ).then(confirmed => {
                                        if (confirmed) {
                                            item.locator = best.locator;
                                            localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                                            this.updateDropdown();
                                            LocatorX.notifications.success('Locator updated');
                                        }
                                    });
                                });
                            }
                        });
                    }
                    return;
                }

                if (e.target.classList.contains('saved-copy') || e.target.closest('.saved-copy')) {
                    const item = e.target.closest('.saved-item');
                    const locator = item.querySelector('.saved-locator-code').textContent; // Fix class selector
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
        },

        exportLocators() {
            const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
            if (saved.length === 0) {
                LocatorX.notifications.info('No locators to export');
                return;
            }

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saved, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "locator-x_saved.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
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
                            const rename = await LocatorX.modal.confirm(
                                'Rename Locator',
                                `Locator already exists as "${existing.name}". Do you want to rename it?`
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

                        // Auto-detect type
                        const type = LocatorX.table.detectLocatorType(locator);

                        saved.push({
                            name,
                            type,
                            locator,
                            fingerprint: LocatorX.filters.lastFingerprint,
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

                    // Auto-detect type if saving from table (though table usually has type)
                    // If type is empty or 'Manual', try to detect
                    if (!type || type === 'Manual') {
                        type = this.detectLocatorType(locator);
                    }

                    saved.push({
                        name: savedName,
                        type,
                        locator,
                        fingerprint: LocatorX.filters.lastFingerprint,
                        date: new Date().toISOString()
                    });
                    localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                    LocatorX.savedLocators.updateDropdown();
                    LocatorX.notifications.success(`Locator saved as "${savedName}"`);
                }
                if (e.target.classList.contains('bi-trash')) {
                    const row = e.target.closest('tr');
                    if (row) {
                        if (row.closest('.pom-table')) {
                            LocatorX.pom.deleteLocator(row);
                        } else {
                            row.remove();
                            this.updateRowNumbers();
                        }
                    }
                }
            });
        },

        detectLocatorType(locator) {
            if (!locator) return 'Unknown';
            locator = locator.trim();
            if (locator.startsWith('/') || locator.startsWith('(') || locator.startsWith('xpath:')) return 'XPath';
            if (locator.startsWith('#')) return 'ID';
            if (locator.startsWith('.')) return 'Class';
            // Simple heuristics for CSS
            if (locator.includes('[') || locator.includes('>') || locator.includes(':') || locator.includes(' ')) return 'CSS';
            // Default to Tag or general text
            return 'CSS';
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
                            // Single click - highlight in search (only for locator cells, not name cells)
                            if (!e.target.classList.contains('saved-name')) {
                                const locator = e.target.textContent;
                                const searchInput = document.querySelector('.search-input');
                                if (searchInput) {
                                    searchInput.value = locator;
                                    searchInput.focus();
                                }
                            }
                            clickCount = 0;
                        }, 300);
                    } else if (clickCount === 2) {
                        // Double click - make editable
                        clearTimeout(clickTimeout);

                        let onSave = null;
                        if (e.target.classList.contains('saved-name')) {
                            const savedItem = e.target.closest('.saved-item');
                            const index = parseInt(savedItem.dataset.index);
                            onSave = (newName) => {
                                const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                                if (saved[index]) {
                                    saved[index].name = newName;
                                    localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                                }
                            };
                        }

                        this.makeEditable(e.target, onSave);
                        clickCount = 0;
                    }
                }
            });
        },

        makeEditable(cell, onSave = null) {
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
                const newValue = input.value || currentValue;
                cell.textContent = newValue;
                cell.classList.remove('editing');

                if (newValue !== currentValue) {
                    if (onSave) {
                        onSave(newValue);
                    } else if (cell.closest('.locator-table')) {
                        // Trigger match count update for this row
                        this.updateMatchCount(cell);
                    }
                }
            };

            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEdit();
                if (e.key === 'Escape') {
                    cell.textContent = currentValue;
                    cell.classList.remove('editing');
                }
            });
        },

        updateMatchCount(cell) {
            const row = cell.closest('tr');
            if (!row) return;

            const badge = row.querySelector('.match-count');
            const typeCell = row.cells[1]; // Typically the second column
            const locator = cell.textContent.trim();

            if (!badge || !locator) return;

            const type = typeCell ? typeCell.textContent.trim() : null;

            badge.textContent = '...';
            badge.className = 'match-count'; // Reset

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'evaluateSelector',
                        selector: locator,
                        type: type
                    }, (response) => {
                        if (chrome.runtime.lastError || !response || typeof response.count === 'undefined') {
                            badge.textContent = '0';
                            badge.classList.add('match-none');
                            return;
                        }

                        const count = response.count;
                        badge.textContent = count;
                        badge.classList.add(count === 0 ? 'match-none' : (count === 1 ? 'match-single' : 'match-multiple'));

                        // Also highlight matches while editing
                        if (count > 0) {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'highlightMatches',
                                selector: locator
                            }).catch(() => { });
                        }
                    });
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

// Establish long-lived connection to background script for cleanup detection
chrome.runtime.connect({ name: 'sidepanel' });