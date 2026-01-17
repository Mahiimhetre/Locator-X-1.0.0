// Locator-X Web Extension - UI Controller
// Clean, minimal implementation with dependency synchronization

const LocatorX = {
    core: null,
    modal: null,

    utils: {
        async copyToClipboard(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                throw new Error('Clipboard API unavailable');
            } catch (err) {
                // Fallback: Create a hidden textarea and use execCommand('copy')
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    textArea.style.top = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) return true;
                } catch (fallbackErr) {
                    console.error('Fallback copy failed:', fallbackErr);
                }
                return false;
            }
        }
    },

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

            const tbody = document.querySelector('.pom-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            // Retrieve structural info from filters (or recalculate if undefined)
            let structure = LocatorX.filters.pomStructure;
            if (!structure) {
                // Fallback if updatePOMTable hasn't run yet
                LocatorX.filters.updatePOMTable();
                structure = LocatorX.filters.pomStructure;
            }

            const { standard, hasGrouped, groupedTypes } = structure;

            page.locators.forEach((item, index) => {
                // Handle legacy data (item is array) vs new data (item is {locators, fingerprint})
                const elementLocators = Array.isArray(item) ? item : item.locators;
                const hasFingerprint = !Array.isArray(item) && item.fingerprint;

                const row = document.createElement('tr');
                row.innerHTML = `<td>${index + 1}</td>`;

                // Render Standard Columns
                standard.forEach(type => {
                    const matching = elementLocators.find(l => l.type === type);
                    const val = matching ? matching.locator : '-';
                    // Add distinct style for empty
                    const style = matching ? '' : 'color: var(--secondary-text); opacity: 0.5;';
                    row.innerHTML += `<td class="lx-editable" data-target="pom-cell" data-locator-type="${type}" style="${style}">${val}</td>`;
                });

                // Render Grouped Column (Relative XPath) if needed
                if (hasGrouped) {
                    // Only use enabled subtypes for the dropdown
                    if (groupedTypes.length > 0) {
                        // Find which locators actually exist for this element
                        const validGrouped = elementLocators.filter(l => groupedTypes.includes(l.type));

                        // 1. Try 'Relative XPath' if available and valid
                        let preferredType = '';
                        const relativeFn = validGrouped.find(l => l.type === 'Relative XPath');

                        if (relativeFn) {
                            preferredType = 'Default';
                        } else if (validGrouped.length > 0) {
                            preferredType = validGrouped[0].type;
                        } else {
                            preferredType = groupedTypes.includes('Default') ? 'Default' : groupedTypes[0];
                        }

                        const preferredLocatorFn = elementLocators.find(l => l.type === preferredType);
                        const preferredValue = preferredLocatorFn ? preferredLocatorFn.locator : '-';
                        const valStyle = preferredLocatorFn ? '' : 'color: var(--secondary-text); opacity: 0.5;';

                        // Create Dropdown Options
                        const options = groupedTypes.map(type => {
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
                                     <div class="strategy-value lx-editable" data-target="pom-cell" data-is-strategy="true" style="${valStyle}">${preferredValue}</div>
                                </div>
                            </td>`;
                    } else {
                        // Should technically not happen if hasGrouped is true, but safe fallback
                        row.innerHTML += `<td class="lx-editable" data-target="pom-cell" data-locator-type="Strategy" style="color: var(--secondary-text); opacity: 0.5;">-</td>`;
                    }
                }

                // Actions Column
                const healBtn = hasFingerprint
                    ? `<i class="bi-bandaid heal-btn" title="Heal Locator" style="color: var(--status-green); cursor: pointer; margin-right: 6px;"></i>`
                    : `<i class="bi-bandaid" title="Missing Fingerprint" style="color: var(--border-light); cursor: not-allowed; margin-right: 6px;"></i>`;

                row.innerHTML += `<td>
                    ${healBtn}
                    <i class="bi-clipboard" title="Copy"></i>
                    <i class="bi-trash" title="Delete"></i>
                </td>`;

                // Bind Events
                if (hasGrouped) {
                    const select = row.querySelector('.pom-strategy-select');
                    if (select) {
                        select.addEventListener('change', (e) => {
                            const newType = e.target.value;
                            const newValue = elementLocators.find(l => l.type === newType);
                            const valDiv = row.querySelector('.strategy-value');

                            if (valDiv) {
                                if (newValue) {
                                    valDiv.textContent = newValue.locator;
                                    valDiv.style.color = '';
                                    valDiv.style.opacity = '1';
                                } else {
                                    valDiv.textContent = '-';
                                    valDiv.style.color = 'var(--secondary-text)';
                                    valDiv.style.opacity = '0.5';
                                }
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

                        if (chrome.runtime.lastError) {
                            LocatorX.notifications.error('Connection lost. Please refresh the page.');
                            return;
                        }

                        if (!response || !response.success) {
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
            document.getElementById('navAxes').addEventListener('click', () => this.switch('axes'));
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
            document.querySelectorAll('.home-container, .pom-container, .axes-container').forEach(el => el.classList.remove('active'));

            if (tab === 'home') {
                LocatorX.filters.saveCurrentFilters('pom');
                LocatorX.filters.loadFilters('home');
                document.getElementById('navHome').classList.add('active');
                document.querySelector('.home-container').classList.add('active');
                this.updateScope('bi-house', 'Home');
                LocatorX.filters.updateTable();
            } else if (tab === 'axes') {
                // Axes Tab
                document.getElementById('navAxes').classList.add('active');
                document.querySelector('.axes-container').classList.add('active');
                this.updateScope('bi-diagram-2', 'Axes');
            } else {
                LocatorX.filters.saveCurrentFilters('home');
                LocatorX.filters.loadFilters('pom');
                document.getElementById('navPOM').classList.add('active');
                document.querySelector('.pom-container').classList.add('active');
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
            LocatorX.filters.updateFilterVisibility(tab);
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

    // Axes Management
    axes: {
        init() {
            const swapBtn = document.getElementById('axesSwapBtn');

        },

        swap() {
            const btn = document.getElementById('axesSwapBtn');
            if (btn) btn.style.opacity = '0.5';

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'swapAxes' }, () => {
                        // Response handled by message listener (axesResult), but we clear opacity here
                        if (btn) btn.style.opacity = '1';
                    });
                }
            });
        },

        updateResultMatch(locator) {
            const badge = document.getElementById('axesMatchCount');
            if (!badge) return;

            // Use attribute for '...' state if needed, or handle via class
            // Actually, for '...' typically we might want text, but user said "css copy data count". 
            // Let's assume data-count can hold "..." or we handle loading state differently?
            // Existing code set text to '...'.
            // Let's set data-count to '...' so CSS picks it up.
            badge.setAttribute('data-count', '...');
            badge.className = 'match-badge';

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'evaluateSelector',
                        selector: locator,
                        type: 'xpath'
                    }, (status) => {
                        if (chrome.runtime.lastError || !status) {
                            // badge.textContent = '0'; // REMOVED
                            badge.dataset.count = '0';
                            return;
                        }

                        badge.dataset.count = status.count;
                        badge.classList.remove('hidden'); // Ensure visible

                        // Highlight matches
                        if (status.count > 0) {
                            chrome.tabs.sendMessage(tab.id, { action: 'highlightMatches', selector: locator }).catch(() => { });
                        }
                    });
                }
            });
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
            this.setupHorizontalScroll();
            this.loadFiltersFromStorage();
            this.saveCurrentFilters('home');
            this.updateTable();
        },

        setupHorizontalScroll() {
            const container = document.querySelector('.locator-options');
            if (container) {
                container.addEventListener('wheel', (e) => {
                    if (e.deltaY !== 0) {
                        e.preventDefault();
                        container.scrollLeft += e.deltaY;
                    }
                }, { passive: false });
            }
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

            if (tab === 'pom') {
                this.pomFilters = filters;
            } else {
                // Home and Axes share filters (or default)
                this.homeFilters = filters;
            }
        },

        loadFilters(tab) {
            const filters = tab === 'pom' ? this.pomFilters : this.homeFilters;

            if (Object.keys(filters).length === 0) return;

            Object.keys(filters).forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = filters[id];
            });

            this.updateSelectAllState();
            this.updateNestedIcon();
        },

        getRelevantFilterIds(tab) {
            // All tabs use CORE now
            return LocatorXConfig.FILTER_GROUPS.CORE;
        },

        updateSelectAllState() {
            const selectAll = document.getElementById('locTypeAll');
            if (!selectAll) return;

            const relevantIds = this.getRelevantFilterIds(LocatorX.tabs.current);
            // Only check top-level checkboxes for 'Select All' state
            const checkboxes = Array.from(document.querySelectorAll('.loc-type'))
                .filter(cb => relevantIds.includes(cb.id));

            if (checkboxes.length === 0) return;

            const allChecked = checkboxes.every(cb => cb.checked);
            const noneChecked = checkboxes.every(cb => !cb.checked);

            selectAll.checked = allChecked;
            selectAll.indeterminate = !allChecked && !noneChecked;
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
            const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');

            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    const relevantIds = this.getRelevantFilterIds(LocatorX.tabs.current);
                    // Update both main and nested checkboxes that are relevant
                    const checkboxes = document.querySelectorAll('.loc-type, .nested-loc-type');

                    checkboxes.forEach(cb => {
                        if (relevantIds.includes(cb.id)) {
                            cb.checked = selectAll.checked;
                        }
                    });

                    // Nested checkboxes logic is now covered by the generic loop above if IDs are in relevantIds,
                    // but we still update the icon just in case.
                    this.updateNestedIcon();

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else if (LocatorX.tabs.current === 'axes') {
                        this.updateTable(); // Reuse table update for axes if needed or just sync
                    } else if (LocatorX.tabs.current === 'pom') {
                        this.updatePOMTable();
                    }
                });
            }
        },

        setupCheckboxes() {
            const checkboxes = document.querySelectorAll('.loc-type');
            const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');

            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    this.updateSelectAllState();

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else {
                        this.updatePOMTable();
                    }
                });
            });

            // Special handling for Relative XPath parent checkbox
            const relativeXPath = document.getElementById('relativeXPath');
            if (relativeXPath) {
                relativeXPath.addEventListener('change', () => {
                    if (relativeXPath.checked) {
                        const defaultXpath = document.getElementById('xpathLocator');
                        if (defaultXpath && !defaultXpath.checked) defaultXpath.checked = true;
                    }
                    this.updateNestedIcon();
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') this.updateTable();
                    else this.updatePOMTable();
                });
            }

            nestedCheckboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const relativeXPath = document.getElementById('relativeXPath');
                    const anyNested = Array.from(nestedCheckboxes).some(c => c.checked);

                    if (relativeXPath) relativeXPath.checked = anyNested;
                    this.updateNestedIcon();

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') this.updateTable();
                    else this.updatePOMTable();
                });
            });
        },

        updateFilterVisibility(tab) {
            // Dynamically calculate non-Axes filters using Global Config
            // Formerly hid filters for Axes. Now simplified to show all filters or custom logic if needed.
            // For now, per user request, we remove specific Axes filter hiding logic so it behaves like Home.

            // If we wanted to hide specific ones, we would do:
            // const axesIds = LocatorXConfig.FILTER_GROUPS.AXES;
            // ...

            // Re-show all if previously hidden?
            // Since we might have hidden them before, we should ensure they are visible.
            const allIds = LocatorXConfig.FILTER_GROUPS.CORE;
            allIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const label = el.closest('label');
                    if (label) label.style.display = '';
                }
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

            const groupedTypes = [
                LocatorXConfig.STRATEGY_NAMES.xpath,
                LocatorXConfig.STRATEGY_NAMES.containsXpath,
                LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.partialLinkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                LocatorXConfig.STRATEGY_NAMES.cssXpath
            ];

            const standardTypes = checkedTypes.filter(t => !groupedTypes.includes(t));
            const activeGroupedTypes = checkedTypes.filter(t => groupedTypes.includes(t));

            // 1. Render Standard Types (Structure Only)
            standardTypes.forEach(type => {
                const row = document.createElement('tr');
                row.setAttribute('data-type', type);
                row.innerHTML = `
                        <td><span class="match-count" data-count="0">-</span></td>
                        <td>${type}</td>
                        <td class="lx-editable" data-target="table-cell" style="color: var(--secondary-text); opacity: 0.5;">-</td>
                        <td>
                            <i class="bi-clipboard disabled" title="Copy"></i>
                            <i class="bi-bookmark-plus disabled" title="Save"></i>
                        </td>
                    `;
                tbody.appendChild(row);
            });

            // 2. Render Grouped Types (Structure Only)
            if (activeGroupedTypes.length > 0) {
                // Determine which strategy to show initially: preserve existing selection if possible
                let currentType = activeGroupedTypes.includes('Default')
                    ? 'Default'
                    : activeGroupedTypes[0];

                // If we have data, we might want to be smarter, but for structure, default is fine.
                // We pass [] as locators so it renders default state
                this.renderGroupRow(tbody, activeGroupedTypes, currentType, []);
            }

            // 3. If we have data, populate it now
            if (this.lastLocators && this.lastLocators.length > 0) {
                this.updateTableData(this.lastLocators);

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
                    }
                    else badge.classList.add('hidden');
                }
            }
            this.updatePOMTable();
        },

        updateTableData(locators) {
            const tbody = document.querySelector('.locator-table tbody');
            if (!tbody) return;

            // Update Standard Rows
            const standardRows = tbody.querySelectorAll('tr[data-type]');
            standardRows.forEach(row => {
                const type = row.getAttribute('data-type');
                const locator = locators.find(l => l.type === type);

                const matchCell = row.querySelector('td:nth-child(1) span');
                const valCell = row.querySelector('td:nth-child(3)');
                const actions = row.querySelectorAll('i');

                if (locator) {
                    matchCell.setAttribute('data-count', locator.matches);
                    matchCell.textContent = locator.matches;

                    valCell.textContent = locator.locator;
                    valCell.style.color = '';
                    valCell.style.opacity = '1';

                    actions.forEach(btn => btn.classList.remove('disabled'));
                } else {
                    matchCell.setAttribute('data-count', '0');
                    matchCell.textContent = '-';
                    valCell.textContent = '-';
                    valCell.style.color = 'var(--secondary-text)';
                    valCell.style.opacity = '0.5';
                    actions.forEach(btn => btn.classList.add('disabled'));
                }
            });

            // Update Group Row
            const groupRow = tbody.querySelector('.strategy-row');
            if (groupRow) {
                const select = groupRow.querySelector('.strategy-dropdown');
                if (select) {
                    const availableTypes = Array.from(select.options).map(o => o.value);

                    // Find best strategy among available types
                    let bestType = null;

                    // 1. Try 'Default' if available and valid
                    const relative = locators.find(l => l.type === 'Default');
                    if (availableTypes.includes('Default') && relative) {
                        bestType = 'Default';
                    } else {
                        // 2. Try first available matching locator
                        const firstMatch = availableTypes.find(t => locators.some(l => l.type === t));
                        // 3. Fallback to first available option
                        bestType = firstMatch || availableTypes[0];
                    }

                    if (bestType) {
                        select.value = bestType;
                        const locator = locators.find(l => l.type === bestType);
                        this.updateGroupRow(groupRow, bestType, locator);

                        // Also update options disabled state maybe?
                        // renderGroupRow used allLocators to set disabled state.
                        // Here we should probably update options too.
                        Array.from(select.options).forEach(opt => {
                            const hasLoc = locators.some(l => l.type === opt.value);
                            opt.disabled = false; // Always enabled per user request 
                        });
                    }
                }
            }
        },

        renderRow(tbody, type, locator) {
            const row = document.createElement('tr');
            if (locator) {
                row.innerHTML = `
                    <td><span class="match-count" data-count="${locator.matches}">${locator.matches}</span></td>
                    <td>${locator.type}</td>
                    <td class="lx-editable" data-target="table-cell">${locator.locator}</td>
                    <td>
                        <i class="bi-clipboard" title="Copy"></i>
                        <i class="bi-bookmark-plus" title="Save"></i>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td><span class="match-count" data-count="0">-</span></td>
                    <td>${type}</td>
                    <td class="lx-editable" data-target="table-cell" style="color: var(--secondary-text); opacity: 0.5;">-</td>
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
            const displayCount = locator ? locator.matches : '0';

            // Dropdown Options
            const options = availableTypes.map(type => {
                const typeLocator = allLocators.find(l => l.type === type);
                const isDisabled = false; // Always enabled per user request
                return `<option value="${type}" ${type === currentType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${type}</option>`;
            }).join('');

            const locatorValue = locator ? locator.locator : '-';
            const locatorStyle = locator ? '' : 'style="color: var(--secondary-text); opacity: 0.5;"';
            const actionClass = locator ? '' : 'disabled';

            row.innerHTML = `
                <td><span class="match-count" data-count="${displayCount}" id="strategyMatchCount">${matchCount}</span></td>
                <td class="strategy-cell">
                    <select class="strategy-dropdown" id="strategySelect">
                        ${options}
                    </select>
                </td>
                <td class="lx-editable" id="strategyLocator" data-target="table-cell" ${locatorStyle}>${locatorValue}</td>
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
                    // FIX: Use this.lastLocators to get the most up-to-date data
                    // The 'allLocators' argument passed to this function is often stale (empty array from init)
                    const locators = this.lastLocators || [];
                    const newLocator = locators.find(l => l.type === newType);
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
                matchBadge.setAttribute('data-count', locator.matches);

                locatorCell.textContent = locator.locator;
                locatorCell.style.color = '';
                locatorCell.style.opacity = '1';

                actions.forEach(btn => btn.classList.remove('disabled'));
            } else {
                matchBadge.textContent = '-';
                matchBadge.setAttribute('data-count', '0');

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
                // Data Update Only!
                this.updateTableData(locators);
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
            const tbody = document.querySelector('.pom-container .pom-table tbody');
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
            const table = document.querySelector('.pom-table');
            if (!table) return;

            // 1. CLEAR & BUILD HEADER
            let thead = table.querySelector('thead');
            if (!thead) {
                thead = document.createElement('thead');
                table.appendChild(thead);
            }
            thead.innerHTML = '';

            const checkedTypes = this.getCheckedTypes();
            const groupedTypes = [
                LocatorXConfig.STRATEGY_NAMES.xpath,
                LocatorXConfig.STRATEGY_NAMES.containsXpath,
                LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.partialLinkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                LocatorXConfig.STRATEGY_NAMES.cssXpath
            ];

            const standardTypes = checkedTypes.filter(t => !groupedTypes.includes(t));
            const hasGrouped = checkedTypes.some(t => groupedTypes.includes(t));

            // Store active structure for Row Renderer to use
            this.pomStructure = {
                standard: standardTypes,
                hasGrouped: hasGrouped,
                groupedTypes: checkedTypes.filter(t => groupedTypes.includes(t)) // Pass enabled options for dropdown
            };

            // Build Header Row
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = '<th>#</th>'; // Index

            // Standard Headers
            standardTypes.forEach(type => {
                headerRow.innerHTML += `<th>${type}</th>`;
            });

            // Grouped Header
            if (hasGrouped) {
                headerRow.innerHTML += `<th>Relative XPath</th>`;
            }

            headerRow.innerHTML += '<th>Actions</th>';
            thead.appendChild(headerRow);

            // 2. TRIGGER ROW UPDATE (re-render current page with new structure)
            if (LocatorX.pom && LocatorX.pom.currentPageId) {
                LocatorX.pom.renderTable(LocatorX.pom.currentPageId);
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
                    'xpathLocator': LocatorXConfig.STRATEGY_NAMES.xpath,
                    'containsXpathLocator': LocatorXConfig.STRATEGY_NAMES.containsXpath,
                    'indexedXpathLocator': LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                    'LinkTextXpathLocator': LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                    'PLinkTextXpathLocator': LocatorXConfig.STRATEGY_NAMES.partialLinkTextXpath,
                    'attributeXpathLocator': LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                    'cssXpathLocator': LocatorXConfig.STRATEGY_NAMES.cssXpath
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
                    e.preventDefault();
                    e.stopPropagation();
                    const isVisible = nested.style.display === 'block';

                    if (isVisible) {
                        nested.style.display = 'none';
                        arrow.classList.remove('expanded');
                    } else {
                        // Calculate position relative to viewport
                        const rect = arrow.getBoundingClientRect();
                        nested.style.top = `${rect.bottom + 2}px`;
                        nested.style.left = `${rect.right - 90}px`; // Align right edge
                        nested.style.display = 'block';
                        arrow.classList.add('expanded');
                    }
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
                if (badge) {
                    // badge.textContent = '0'; // REMOVED
                    badge.setAttribute('data-count', '0');
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
                                // Context might be invalidated or tab loading
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
                                    if (respondedFrames === frames.length) {
                                        LocatorX.search.finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult);
                                    }
                                    return;
                                }

                                if (response && typeof response.count !== 'undefined') {
                                    totalCount += response.count;
                                    if (response.count === 1 && !foundResult) {
                                        foundResult = true;
                                        LocatorX.filters.updateElementInfo(response.elementInfo, response.elementType);
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
                                    LocatorX.search.finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult);
                                }
                            });
                        });
                    });
                }
            });
        },

        finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult) {
            LocatorX.search.renderDropdown(suggestions, query, dropdown, totalCount);

            if (!foundResult && totalCount !== 1) {
                LocatorX.filters.updateElementInfo(null, null);
                LocatorX.filters.displayGeneratedLocators([], null, null, null);
            }

            // Update the new search match badge
            if (badge) {
                // badge.textContent = totalCount; // REMOVED
                badge.setAttribute('data-count', totalCount);
            }

            // Trigger highlighting if matches found (in all frames)
            if (totalCount > 0) {
                LocatorX.search.highlightMatchesInAllFrames(query);
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
                } else if (message.action === 'axesAnchorCaptured') {
                    // Update UI for Anchor - Simplified Status
                    const anchorVal = document.getElementById('axesAnchorValue');

                    if (anchorVal) {
                        // Show element tag + ID but cleanly, OR just "Captured" based on request
                        // User said "remove content show text like captured"
                        // We will show "Captured: Tag#ID" for clarity but keep it simple text
                        anchorVal.textContent = `Captured: ${message.elementInfo.tagName}`;
                        anchorVal.style.color = 'var(--text-primary)';
                        anchorVal.style.fontWeight = '500';
                    }

                    // Switch pulse to purple for Target
                    const inspectBtn = document.getElementById('inspectBtn');
                    if (inspectBtn) {
                        inspectBtn.classList.remove('yellow');
                        inspectBtn.classList.add('purple');
                    }

                    // Update Target to show it's next
                    const targetVal = document.getElementById('axesTargetValue');
                    if (targetVal) {
                        targetVal.textContent = 'Select Target...';
                        targetVal.style.color = 'var(--text-secondary)';
                    }

                } else if (message.action === 'axesResult') {
                    // Update UI for Target
                    const targetVal = document.getElementById('axesTargetValue');

                    if (targetVal) {
                        targetVal.textContent = `Captured: ${message.elementInfo.tagName}`;
                        targetVal.style.color = 'var(--text-primary)';
                        targetVal.style.fontWeight = '500';
                    }
                    // Update Result
                    const resultVal = document.getElementById('axesResultValue');
                    const matchBadge = document.getElementById('axesMatchCount');

                    if (resultVal) {
                        // Use textContent to avoid HTML injection, but maybe format it?
                        resultVal.textContent = message.locator || 'No result found';
                        // Auto-copy or similar?
                    }

                    if (matchBadge) {
                        // matchBadge.textContent = message.matchCount; // REMOVED
                        matchBadge.setAttribute('data-count', message.matchCount);
                        if (message.matchCount === 0) matchBadge.classList.add('match-none');
                        else if (message.matchCount === 1) matchBadge.classList.add('match-success');
                        else matchBadge.classList.add('match-warning');
                    }

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

            if (this.currentMode === 'axes' && inspectBtn) {
                inspectBtn.classList.add('yellow');

                // Reset UI Text
                const anchorVal = document.getElementById('axesAnchorValue');
                const targetVal = document.getElementById('axesTargetValue');
                const resultVal = document.getElementById('axesResultValue');

                if (anchorVal) {
                    anchorVal.textContent = 'Select Anchor...';
                    anchorVal.style.color = 'var(--text-secondary)';
                }
                if (targetVal) {
                    targetVal.textContent = 'Waiting...';
                    targetVal.style.color = 'var(--text-secondary)';
                }
                if (resultVal) resultVal.textContent = 'Capture Elements to get the result...';
            }

            // Broadcast to ALL frames
            this.broadcastActionToTab({ action: 'startScanning', mode: this.currentMode });
        },

        deactivate() {
            this.isActive = false;

            const inspectBtn = document.getElementById('inspectBtn');
            if (inspectBtn) {
                inspectBtn.classList.remove('yellow', 'purple');
            }

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
                } else if (this.currentMode === 'axes') {
                    // Yellow Pulse for Axes
                    inspectBtn.style.animation = 'pulse-yellow 2s infinite';
                    inspectBtn.style.color = '#f1c40f';
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
        },


    },

    // Authentication Management
    auth: {
        init() {
            this.loginBtn = document.getElementById('loginBtn');
            this.logoutBtn = document.getElementById('logoutBtn');
            this.userProfile = document.getElementById('userProfile');
            this.userAvatar = document.getElementById('userAvatar');
            this.userInitials = document.getElementById('userInitials');
            this.dropdownUserAvatar = document.getElementById('dropdownUserAvatar');
            this.dropdownUserInitials = document.getElementById('dropdownUserInitials');
            this.userName = document.getElementById('userName');
            this.userPlan = document.getElementById('userPlan');
            this.triggerPlanBadge = document.getElementById('triggerPlanBadge');
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
                console.log('PanelController: Received message', message);
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
                plan: user.plan,
                updated: user._lastUpdated
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
                        if (this.dropdownUserAvatar) this.dropdownUserAvatar.classList.remove('hidden');
                        if (this.dropdownUserInitials) this.dropdownUserInitials.classList.add('hidden');

                        const avatarUrl = user.avatar + (user._lastUpdated ? `?t=${user._lastUpdated}` : '');

                        // Only update .src if it's different to prevent flicker
                        if (this.userAvatar.getAttribute('src') !== avatarUrl) {
                            this.userAvatar.src = avatarUrl;
                        }
                        if (this.dropdownUserAvatar && this.dropdownUserAvatar.getAttribute('src') !== avatarUrl) {
                            this.dropdownUserAvatar.src = avatarUrl;
                        }

                        // Handle broken image -> Switch to initials
                        const handleError = () => {
                            this.userAvatar.classList.add('hidden');
                            if (this.dropdownUserAvatar) this.dropdownUserAvatar.classList.add('hidden');
                            this._showInitials(user.name);
                        };
                        this.userAvatar.onerror = handleError;
                        if (this.dropdownUserAvatar) this.dropdownUserAvatar.onerror = handleError;
                    } else {
                        this.userAvatar.classList.add('hidden');
                        if (this.dropdownUserAvatar) this.dropdownUserAvatar.classList.add('hidden');
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

                if (this.triggerPlanBadge) {
                    this.triggerPlanBadge.textContent = planText;
                    this.triggerPlanBadge.classList.remove('hidden');
                }
            }

            // CRITICAL: Update Feature Gates based on user plan
            if (typeof planService !== 'undefined') {
                planService.applyUIGates();
            }
        },

        _showInitials(name) {
            const initial = name ? name.charAt(0).toUpperCase() : '?';
            if (this.userInitials) {
                this.userInitials.textContent = initial;
                this.userInitials.classList.remove('hidden');
            }
            if (this.dropdownUserInitials) {
                this.dropdownUserInitials.textContent = initial;
                this.dropdownUserInitials.classList.remove('hidden');
            }

            // Deterministic background color
            const colors = ['#8e44ad', '#2980b9', '#27ae60', '#d35400', '#c0392b', '#16a085'];
            const charCodeSum = (name || 'User').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const color = colors[charCodeSum % colors.length];

            if (this.userInitials) this.userInitials.style.backgroundColor = color;
            if (this.dropdownUserInitials) this.dropdownUserInitials.style.backgroundColor = color;
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

    // DevTools Conflict Management
    conflict: {
        init() {
            this.warningOverlay = document.getElementById('devtoolsWarning');
            if (this.warningOverlay) {
                this.checkStatus();
                this.setupListeners();
            }
        },

        async checkStatus() {
            const data = await chrome.storage.local.get('devtoolsActive');
            this.toggleWarning(!!data.devtoolsActive);
        },

        setupListeners() {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.devtoolsActive) {
                    this.toggleWarning(!!changes.devtoolsActive.newValue);
                }
            });
        },

        toggleWarning(show) {
            if (!this.warningOverlay) return;
            if (show) {
                this.warningOverlay.classList.remove('hidden');
            } else {
                this.warningOverlay.classList.add('hidden');
            }
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
        this.conflict.init();

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
                                        <span class="saved-name lx-editable" title="Double-click to rename" data-target="saved-name" data-index="${index}">${item.name}</span>
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
                                    if (chrome.runtime.lastError) {
                                        LocatorX.notifications.error('Connection lost');
                                        return;
                                    }
                                    if (!response || !response.success || !response.locators || response.locators.length === 0) {
                                        LocatorX.notifications.error('Heal failed: No matches found');
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
                    const locator = item.querySelector('.saved-locator-code').textContent;
                    LocatorX.utils.copyToClipboard(locator).then(success => {
                        if (success) LocatorX.notifications.success('Copied!');
                        else LocatorX.notifications.error('Failed to copy');
                    });
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
            this.setupEventListeners();
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
                    LocatorX.utils.copyToClipboard(locator).then(success => {
                        if (success) LocatorX.notifications.success('Locator copied to clipboard');
                        else LocatorX.notifications.error('Failed to copy');
                    });
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
            const pomTable = document.querySelector('.pom-container .locator-table tbody');
            if (pomTable) {
                const rows = pomTable.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    row.cells[0].textContent = index + 1;
                });
            }
        },

        setupEventListeners() {
            // Centralized Event Listener for Update Logic
            document.addEventListener('locatorx-update', (e) => {
                const { newValue, element, context } = e.detail;
                const targetType = context.target;

                if (targetType === 'saved-name') {
                    const index = parseInt(context.index);
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                    if (saved[index]) {
                        saved[index].name = newValue;
                        localStorage.setItem('locator-x-saved', JSON.stringify(saved));
                        LocatorX.savedLocators.updateDropdown();
                        LocatorX.notifications.success('Locator renamed');
                    }
                } else if (targetType === 'table-cell') {
                    this.updateMatchCount(element);
                } else if (targetType === 'axes-result') {
                    LocatorX.axes.updateResultMatch(newValue);
                } else if (targetType === 'pom-cell') {
                    // Start of POM Update Logic
                    const isStrategy = context.isStrategy === 'true';
                    const locatorType = context.locatorType;

                    // TODO: Implement deep update for POM structure if needed (e.g. updating the underlying page object)
                    // For now, we update the UI match count if possible, or just acknowledge the change.
                    // Since POM is complex, we might just want to trigger a re-scan or update the specific locator object in memory.

                    const row = element.closest('tr');
                    /* 
                       Logic to update the specific locator in LocatorX.pom.pages[activePage] 
                       would go here. For now, just ensuring the edit "sticks" in UI is the first step.
                    */
                    LocatorX.notifications.success('Locator updated locally');
                }
            });
        },

        setupEditableCells() {
            let clickCount = 0;
            let clickTimeout;

            document.addEventListener('click', (e) => {
                // Check for generic editable class
                const editableEl = e.target.closest('.lx-editable');
                if (!editableEl) return;

                // Ignore if already editing
                if (editableEl.classList.contains('editing')) return;

                clickCount++;

                if (clickCount === 1) {
                    clickTimeout = setTimeout(() => {
                        // Single click - highlight in search (Table Cells only - heuristic)
                        if (editableEl.dataset.target === 'table-cell') {
                            const locator = editableEl.textContent;
                            const searchInput = document.querySelector('.search-input');
                            if (searchInput) {
                                searchInput.value = locator;
                                searchInput.focus();
                            }
                        }
                        clickCount = 0;
                    }, 300);
                } else if (clickCount === 2) {
                    // Double click detected
                    clearTimeout(clickTimeout);
                    clickCount = 0;

                    // FEATURE GATE: Check for Quick Edit permission
                    if (typeof planService !== 'undefined' && !planService.isEnabled('ui.quickEdit')) {
                        planService._showUpgradePrompt('Quick Edit');
                        return;
                    }

                    this.makeEditable(editableEl);
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
                const newValue = input.value || currentValue;
                cell.textContent = newValue;
                cell.classList.remove('editing');

                if (newValue !== currentValue) {
                    // Dispatch generic update event
                    cell.dispatchEvent(new CustomEvent('locatorx-update', {
                        bubbles: true,
                        detail: {
                            oldValue: currentValue,
                            newValue: newValue,
                            element: cell,
                            context: cell.dataset
                        }
                    }));
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
                        const count = (response && typeof response.count !== 'undefined') ? response.count : 0;

                        if (chrome.runtime.lastError || !response) {
                            badge.textContent = '0';
                            badge.dataset.count = '0';
                            return;
                        }

                        badge.textContent = count;
                        badge.dataset.count = count;
                        badge.classList.remove('hidden');

                        // Clear inline styles to let CSS take over
                        badge.style.backgroundColor = '';
                        badge.style.color = '';

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
LocatorX.init().then(() => {
    // Initialize Axes after main init
    if (LocatorX.axes) LocatorX.axes.init();
}).catch(err => {
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
chrome.runtime.connect({ name: 'locatorx-panel' });