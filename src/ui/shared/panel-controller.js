// Locator-X Web Extension - UI Controller
// Clean, minimal implementation with dependency synchronization

const LocatorX = {
    core: null,
    modal: null,
    evaluator: null,

    utils: {
        async copyToClipboard(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                throw new Error('Clipboard API unavailable');
            } catch (err) {
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
        },

        async evaluate(source, options = {}) {
            if (!LocatorX.evaluator) return 0;
            return LocatorX.evaluator.evaluate(source, { ...options, mode: LocatorX.tabs.current });
        },

        async highlight(selector, action = 'highlightMatches') {
            if (!LocatorX.evaluator) return;
            LocatorX.evaluator.highlight(selector, action, LocatorX.tabs.current);
        },

        _updateBadge(badge, count) {
            let el = typeof badge === 'string' ? document.getElementById(badge) : badge;
            if (el && el.dataset) {
                el.dataset.count = count;
                el.classList.remove('hidden');
            }
        },

        autoFlip(input, dropdown, estimatedHeight = null) {
            if (!input || !dropdown) return;
            const rect = input.getBoundingClientRect();

            // Detect threshold dynamically from CSS (max-height, height, or min-height)
            const style = window.getComputedStyle(dropdown);

            const parseSize = (val) => {
                if (!val || val === 'none') return 0;
                const parsed = parseInt(val);
                return Number.isNaN(parsed) ? 0 : parsed;
            };

            const maxHeight = parseSize(style.maxHeight);
            const height = parseSize(style.height);
            const minHeight = parseSize(style.minHeight);

            // Use the largest of the defined heights as the threshold
            const threshold = estimatedHeight || maxHeight || height || minHeight || 200;

            // Initial space relative to viewport
            let spaceBelow = window.innerHeight - rect.bottom;
            let spaceAbove = rect.top;

            // Check if any parent container (like a modal) is clipping us
            let parent = input.parentElement;
            while (parent && parent !== document.body) {
                const pStyle = window.getComputedStyle(parent);
                const overflow = pStyle.overflow + pStyle.overflowY;
                if (overflow.includes('hidden') || overflow.includes('auto') || overflow.includes('scroll')) {
                    const parentRect = parent.getBoundingClientRect();
                    // How much space is left inside THIS container
                    spaceBelow = Math.min(spaceBelow, parentRect.bottom - rect.bottom);
                    spaceAbove = Math.min(spaceAbove, rect.top - parentRect.top);
                    break;
                }
                parent = parent.parentElement;
            }

            // Flip if space below is too small AND space above is better
            if (spaceBelow < threshold && spaceAbove > spaceBelow) {
                dropdown.classList.add('drop-up');
            } else {
                dropdown.classList.remove('drop-up');
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
            // Enable Ctrl+Scroll for horizontal scrolling
            const pomTableContainer = document.querySelector('.pom-container .table-container');
            if (pomTableContainer) {
                pomTableContainer.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        pomTableContainer.scrollLeft += e.deltaY;
                    }
                });
            }
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
                LocatorX.notifications.warning('Please select or create a page first.');
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
                                     <select class="strategy-select">
                                        ${options}
                                     </select>
                                     <div class="strategy-value lx-editable" data-target="pom-cell" data-is-strategy="true" style="${valStyle}">${preferredValue}</div>
                                </div>
                            </td>`;
                    } else {
                        // Should technically not happen if hasGrouped is true, but safe fallback
                        row.innerHTML += `<td class="lx-editable" data-target="pom-cell" data-locator-type="Strategy" style="color: var(--secondary-text); opacity: 0.5;"></td>`;
                    }
                }

                // Time Column
                const timestamp = item.timestamp || '-';
                const showTimestamp = LocatorX.filters.showTimestamp;
                row.innerHTML += `<td class="time-column ${showTimestamp ? '' : 'hidden'}">${timestamp}</td>`;

                // Actions Column
                row.innerHTML += `<td>
                    <i class="bi-clipboard" title="Copy"></i>
                    <i class="bi-trash" title="Delete"></i>
                </td>`;

                // Bind Events
                if (hasGrouped) {
                    const select = row.querySelector('.strategy-select');
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
            document.getElementById('navAxes').addEventListener('click', () => this.switch('axes'));

            // Dynamic View Close Button
            const closeBtn = document.getElementById('closeDynamicBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => LocatorX.dynamicView.hide());
            }

            // Open MultiScan Directly
            const navMultiScan = document.getElementById('navMultiScan');
            if (navMultiScan) {
                navMultiScan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    LocatorX.dropdowns.closeAll();
                    LocatorX.multiScan.show();
                });
            }

            this.switch('home');
        },

        switch(tab) {
            // Prevent switching if inspection is active
            if (LocatorX.inspect.isActive) {
                LocatorX.notifications.error('Please stop inspection before switching tabs.');
                return;
            }

            // Update UI
            // Update UI
            document.querySelectorAll('.nav-option').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));

            // Handle MultiScan Active State
            const navMultiScan = document.getElementById('navMultiScan');
            if (navMultiScan) navMultiScan.classList.remove('active');

            if (tab === 'home') {
                LocatorX.filters.saveCurrentFilters('pom');
                LocatorX.filters.loadFilters('home');
                document.getElementById('navHome').classList.add('active');
                document.querySelector('.home-container').classList.add('active');
                LocatorX.filters.updateTable();
            } else if (tab === 'axes') {
                // Axes Tab
                document.getElementById('navAxes').classList.add('active');
                document.querySelector('.axes-container').classList.add('active');
            } else if (tab === 'pom') {
                LocatorX.filters.saveCurrentFilters('home');
                LocatorX.filters.loadFilters('pom');
                document.getElementById('navPOM').classList.add('active');
                document.querySelector('.pom-container').classList.add('active');
                LocatorX.filters.updatePOMTable();

                // Init POM if needed
                if (!LocatorX.pom.currentPageId) {
                    LocatorX.pom.init();
                } else {
                    // re-render in case filter changed
                    LocatorX.pom.renderTable(LocatorX.pom.currentPageId);
                }
            } else {
                // Dynamic View (Default)
                document.querySelector('.dynamic-container').classList.add('active');
                if (navMultiScan) navMultiScan.classList.add('active');
                this.current = 'dynamic'; // Ensure state reflects dynamic
            }
            this.current = tab;

            // Sync Inspect Mode if active
            if (LocatorX.inspect && LocatorX.inspect.isActive) {
                LocatorX.inspect.currentMode = tab;
                LocatorX.inspect.updateUI();
            }
            LocatorX.filters.updateFilterVisibility(tab);
        },
    },

    // Dynamic View Manager
    dynamicView: {
        lastTab: 'home',

        show(title, content) {
            this.lastTab = LocatorX.tabs.current !== 'dynamic' ? LocatorX.tabs.current : 'home';

            const titleEl = document.getElementById('dynamicTitle');
            const contentEl = document.getElementById('dynamicContent');

            if (titleEl) titleEl.textContent = title;
            if (contentEl) contentEl.innerHTML = content;

            LocatorX.tabs.switch('dynamic');
        },

        hide() {
            LocatorX.tabs.switch(this.lastTab);
        }
    },

    // Axes Management
    axes: {
        init() {
            const swapBtn = document.getElementById('axesSwapBtn');
            if (swapBtn) {
                swapBtn.addEventListener('click', () => this.swap());
            }
        },

        swap() {
            const btn = document.getElementById('axesSwapBtn');
            if (btn) btn.style.opacity = '0.5';

            // 1. Swap UI Text Immediately for responsiveness
            const anchorVal = document.getElementById('axesAnchorValue');
            const targetVal = document.getElementById('axesTargetValue');

            if (anchorVal && targetVal) {
                const tempText = anchorVal.textContent;
                const tempColor = anchorVal.style.color;
                const tempWeight = anchorVal.style.fontWeight;

                anchorVal.textContent = targetVal.textContent;
                anchorVal.style.color = targetVal.style.color;
                anchorVal.style.fontWeight = targetVal.style.fontWeight;

                targetVal.textContent = tempText;
                targetVal.style.color = tempColor;
                targetVal.style.fontWeight = tempWeight;
            }

            // 2. Clear Result during swap
            const resultVal = document.getElementById('axesResultValue');
            const matchBadge = document.getElementById('axesMatchCount');
            if (resultVal) resultVal.textContent = 'Calculating...';
            if (matchBadge) {
                matchBadge.setAttribute('data-count', '...');
            }

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
            LocatorX.utils.evaluate(locator, {
                type: 'xpath',
                badge: 'axesMatchCount'
            });
        }
    },

    // MultiScan Management
    multiScan: {
        mode: 'file', // 'file' or 'text'
        manager: null,
        overlay: null,
        detectionMode: 'auto', // 'auto', 'manual', 'hybrid'
        currentMatches: [],
        currentFile: null,

        init() {
            if (!this.manager && typeof MultiScanManager !== 'undefined') {
                this.manager = new MultiScanManager();
            }
            this.createModal();
        },

        createModal() {
            // Reuse existing modal if available
            if (this.overlay) return;

            // Ensure LocatorX.modal is initialized
            if (!LocatorX.modal) {
                LocatorX.modal = new LocatorXModal();
            }

            this.overlay = LocatorX.modal.overlay;
        },

        close() {
            if (this.overlay) this.overlay.classList.remove('active');
        },

        show() {
            this.createModal();
            // Capture Current URL
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    this.currentTabUrl = tabs[0].url;
                }
                this.renderInputState();
                this.overlay.classList.add('active');
            });

            // Custom Close Hander for Multiscan specific state cleanup if needed
            const closeBtn = this.overlay.querySelector('.modal-close');

        },

        renderInputState() {
            const title = this.overlay.querySelector('.modal-title');
            const body = this.overlay.querySelector('.modal-body');
            const footer = this.overlay.querySelector('.modal-footer');

            title.textContent = 'Multi-Locator Scan';
            footer.classList.add('hidden');

            const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'selenium';

            body.innerHTML = `
                <!-- Tabs -->
                <div class="control-group ms-control-group">
                    <button class="save-btn ms-tab-btn ${this.mode === 'text' ? '' : 'ms-btn-inactive'}" id="msModeText">
                        <span>📝</span> Text
                    </button>
                    <button class="save-btn ms-tab-btn ${this.mode === 'file' ? '' : 'ms-btn-inactive'}" id="msModeFile">
                        <span>📁</span> File
                    </button>
                </div>

                <!-- Input Area -->
                <div class="control-group ms-input-area" id="msInputArea">
                    ${this.getInputHtml()}
                </div>

                <!-- Target URL (New) -->
                <div class="control-group ms-target-url-group">
                    <label class="setting-label" style="font-size: smaller;" title="Target URL (for verification)"> URL </label>
                    <input type="text" id="msTargetUrl" class="search-input" placeholder="https://example.com" value="${this.currentTabUrl || ''}" autocomplete="off">
                </div>

                <!-- Options -->
                <div class="control-group ms-setting-group">
                    <label class="setting-label" style="font-size: smaller;" title="Pattern Detection Strategy">Pattern </label>
                    <select id="msDetectionMode" class="ms-mode-select">
                        <option value="auto" ${this.detectionMode === 'auto' ? 'selected' : ''}>Auto-Analyse (Fast)</option>
                        <option value="manual" ${this.detectionMode === 'manual' ? 'selected' : ''}>Manual Pattern</option>
                        <option value="hybrid" ${this.detectionMode === 'hybrid' ? 'selected' : ''}>Hybrid (Auto + Manual)</option>
                    </select>
                </div>
                <div class="ms-setting-note" style="margin-top: -8px; margin-bottom: 8px;">
                     ${this.getModeNote(framework)}
                </div>

                <!-- Manual Pattern Input (Hidden if Auto) -->
                <div class="control-group ${this.detectionMode === 'auto' ? 'hidden' : ''}" id="msPatternContainer">
                    <input type="text" id="msSyntaxInput" class="search-input" placeholder="Select or type pattern ({type}, {locator})..." autocomplete="off">
                    <div id="msSyntaxDropdown" class="search-dropdown"></div>
                </div>

                <!-- Action -->
                <div class="modal-footer ms-modal-footer">
                    <button class="modal-btn primary ms-scan-btn" id="msScanBtn">Scan</button>
                </div>
                
                <!-- Result Area -->
                <div id="msResultContainer" class="ms-result-area hidden"></div>
            `;

            this.bindInputEvents();
        },

        getModeNote(framework) {
            if (this.detectionMode === 'auto') return `Automatically detect locators for ${framework}.`;
            if (this.detectionMode === 'manual') return `Use a custom pattern to find locators.`;
            return `Auto-detect ${framework} patterns AND apply your custom pattern.`;
        },

        getInputHtml() {
            if (this.mode === 'file') {
                if (this.currentFile) {
                    const size = this.currentFile.size > 1024 * 1024
                        ? (this.currentFile.size / (1024 * 1024)).toFixed(1) + ' MB'
                        : (this.currentFile.size / 1024).toFixed(1) + ' KB';
                    return `
                        <div class="ms-file-name">
                            <i class="bi-check-circle-fill ms-file-success-icon"></i>
                            <span>${this.currentFile.name}</span>
                            <span class="ms-file-size">(${size})</span>
                            <i class="bi-x-lg ms-remove-file" id="msRemoveFile"></i>
                        </div>`;
                }
                return UniversalDragDrop.getTemplate('msDropZone', 'msFileInput');
            } else {
                return `<textarea id="msTextInput" class="search-input ms-text-input" placeholder="Paste your code or text here..."></textarea>`;
            }
        },

        bindInputEvents() {
            document.getElementById('msModeFile').addEventListener('click', () => { this.mode = 'file'; this.renderInputState(); });
            document.getElementById('msModeText').addEventListener('click', () => { this.mode = 'text'; this.renderInputState(); });

            const modeSelect = document.getElementById('msDetectionMode');
            const patternContainer = document.getElementById('msPatternContainer');
            if (modeSelect) {
                modeSelect.addEventListener('change', (e) => {
                    this.detectionMode = e.target.value;
                    this.renderInputState();
                });
            }

            const scanBtn = document.getElementById('msScanBtn');
            scanBtn.addEventListener('click', () => this.performScan());

            if (this.mode === 'file') {
                const dropZone = document.getElementById('msDropZone');
                const fileInput = document.getElementById('msFileInput');
                const removeBtn = document.getElementById('msRemoveFile');

                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        this.currentFile = null;
                        this.renderInputState();
                    });
                }

                if (dropZone && fileInput && typeof UniversalDragDrop !== 'undefined') {
                    UniversalDragDrop.setup(dropZone, fileInput, (files) => {
                        if (files && files.length > 0) {
                            this.currentFile = files[0];
                            this.renderInputState();
                        }
                    });
                }
            }

            // Pattern Input Logic
            const syntaxInput = document.getElementById('msSyntaxInput');
            const syntaxDropdown = document.getElementById('msSyntaxDropdown');
            if (syntaxInput && syntaxDropdown) {
                const handler = () => this.handleSyntaxInput(syntaxInput, syntaxDropdown);
                syntaxInput.addEventListener('focus', handler);
                syntaxInput.addEventListener('input', handler);
                syntaxInput.addEventListener('blur', () => setTimeout(() => syntaxDropdown.style.display = 'none', 200));
            }
        },

        // Reusing existing helper for syntax dropdown
        handleSyntaxInput(input, dropdown) {
            const query = input.value;
            const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'selenium-java';
            const matches = this.manager.filterPatterns(query, framework);

            if (matches.length > 0) {
                dropdown.innerHTML = '';
                matches.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'dropdown-item';
                    div.innerHTML = `<span class="item-text">${p.label}</span>`;
                    div.addEventListener('click', () => {
                        input.value = p.template;
                        dropdown.style.display = 'none';
                    });
                    dropdown.appendChild(div);
                });
                dropdown.style.display = 'block';
                dropdown.classList.add('visible');

                LocatorX.utils.autoFlip(input, dropdown);
            } else {
                dropdown.style.display = 'none';
                dropdown.classList.remove('drop-up');
            }
        },

        performScan() {
            const scanBtn = document.getElementById('msScanBtn');
            const originalText = scanBtn.textContent;

            // UI Feedback
            scanBtn.classList.add('scanning');
            scanBtn.innerHTML = `<span class="ms-spinner"></span> Scanning...`;

            // READ INPUT
            let contentProm;
            let sourceName = 'Text Input';

            if (this.mode === 'file') {
                if (!this.currentFile) {
                    LocatorX.notifications.warning('Please select a file to scan.');
                    this.resetScanBtn(scanBtn, originalText);
                    return;
                }
                sourceName = this.currentFile.name;
                contentProm = this.manager.readFile(this.currentFile);
            } else {
                const textInput = document.getElementById('msTextInput');
                if (!textInput || !textInput.value.trim()) {
                    LocatorX.notifications.warning('Please enter text to scan.');
                    this.resetScanBtn(scanBtn, originalText);
                    return;
                }
                contentProm = Promise.resolve(textInput.value);
            }

            // EXECUTE SCAN
            contentProm.then(text => {
                const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'all';
                let matches = [];

                const performAuto = () => this.manager.autoScan(text, framework);
                const performManual = () => {
                    const pattern = document.getElementById('msSyntaxInput').value;
                    if (!pattern) return [];
                    const regex = this.manager.convertSmartPatternToRegex(pattern);
                    return this.manager.findMatches(text, regex, true, pattern);
                };

                if (this.detectionMode === 'auto') {
                    matches = performAuto();
                } else if (this.detectionMode === 'manual') {
                    matches = performManual();
                    if (matches.length === 0) LocatorX.notifications.warning('No matches found for custom pattern.');
                } else if (this.detectionMode === 'hybrid') {
                    const autoMatches = performAuto();
                    const manualMatches = performManual();
                    // Merge and deduplicate by locator
                    const map = new Map();
                    [...autoMatches, ...manualMatches].forEach(m => map.set(m.locator, m));
                    matches = Array.from(map.values());
                }

                this.currentMatches = matches;

                // Final Button State
                scanBtn.textContent = 'Scan Again';
                scanBtn.classList.remove('scanning');

                setTimeout(() => this.renderResultState(matches.length, sourceName), 300);

            }).catch(err => {
                console.error(err);
                LocatorX.notifications.error('Scan Failed: ' + err.message);
                this.resetScanBtn(scanBtn, originalText);
            });
        },

        resetScanBtn(btn, text) {
            btn.classList.remove('scanning');
            btn.textContent = text;
        },

        renderResultState(count, sourceName) {
            const container = document.getElementById('msResultContainer');
            if (!container) return;

            container.innerHTML = `
                <div class="ms-result-compact">
                    <div class="ms-result-info">
                        <i class="bi-check-circle-fill ms-success-icon-small"></i>
                        <span class="ms-result-text">Found <strong class="ms-result-count">${count}</strong> in "${sourceName}"</span>
                    </div>
                    <button class="modal-btn secondary small ms-compact-btn" id="msSeeResult">See Result</button>
                </div >
    `;

            container.classList.remove('hidden');

            const seeResult = document.getElementById('msSeeResult');
            if (seeResult) {
                seeResult.addEventListener('click', () => {
                    // Check URL Match
                    const targetUrlInput = document.getElementById('msTargetUrl');
                    const targetUrl = targetUrlInput ? targetUrlInput.value.trim() : '';

                    if (targetUrl) {
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            const currentUrl = tabs[0].url;

                            // Simple normalization (remove trailing slash)
                            const normTarget = targetUrl.replace(/\/$/, '');
                            const normCurrent = currentUrl.replace(/\/$/, '');

                            if (!normCurrent.includes(normTarget)) {
                                LocatorX.modal.confirm(
                                    'URL Mismatch',
                                    `Target URL: <b>${targetUrl}</b><br>Current URL: <b>${currentUrl}</b><br><br>Verification might fail. Proceed?`,
                                    { icon: 'bi-exclamation-triangle-fill' }
                                ).then(confirmed => {
                                    if (confirmed) this.openResultsInTable();
                                });
                            } else {
                                this.openResultsInTable();
                            }
                        });
                    } else {
                        // No target URL, verify anyway? Or prompt? 
                        // Plan said: Optional for scanning, Mandatory for Verify.
                        // But "See Result" implies viewing them. Verification happens automatically in table.
                        this.openResultsInTable();
                    }
                });
            }
        },

        openResultsInTable() {
            this.close(); // Close Modal

            // Build Dynamic View Content
            const content = `
                <div class="table-container ms-table-container">
                    <table class="locator-table" id="msResultsTable">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Match</th>
                                <th>Type</th>
                                <th>Locator</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            LocatorX.dynamicView.show('Scan Results', content);

            // Add Rescan Button to Header (Injecting into dynamic header)
            const header = document.querySelector('.dynamic-header');
            if (header && !document.getElementById('headerRescanBtn')) {
                const rescanBtn = document.createElement('button');
                rescanBtn.id = 'headerRescanBtn';
                rescanBtn.className = 'save-btn ms-header-rescan';
                rescanBtn.textContent = 'Rescan';

                rescanBtn.addEventListener('click', () => {
                    LocatorX.dynamicView.hide(); // Go back? or just open modal?
                    this.show();
                });

                header.appendChild(rescanBtn);
            }

            this.renderTableRows(this.currentMatches);
        },

        renderTableRows(matches) {
            const tbody = document.querySelector('#msResultsTable tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (matches.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="ms-empty-row">No matches found.</td></tr>`;
                return;
            }

            matches.forEach((match) => {
                const { index, type, locator } = match;
                const row = document.createElement('tr');
                const matchId = `ms-match-${index}`; // Ensure unique ID per scan

                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td><span class="match-count" id="${matchId}" data-count="..."></span></td>
                    <td class="lx-editable ms-type-cell">${type}</td>
                    <td class="lx-editable">${locator}</td>
                    <td>
                        <i class="bi-clipboard ms-copy-icon" title="Copy"></i>
                    </td>
                `;
                tbody.appendChild(row);

                // Copy Action
                row.querySelector('.bi-clipboard').addEventListener('click', () => {
                    LocatorX.utils.copyToClipboard(locator);
                    LocatorX.notifications.success('Locator copied!');
                });

                // Validate
                this.validateMatch(locator, type, matchId);
            });
        },

        validateMatch(locator, type, matchId) {
            let totalCount = 0;
            let suggestion = null;
            let updated = false;

            chrome.storage.local.get(['smartCorrectEnabled'], (result) => {
                const enableSmartCorrect = result.smartCorrectEnabled !== undefined ? result.smartCorrectEnabled : true;

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (tab && tab.id) {
                        chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                            let pending = frames ? frames.length : 0;
                            if (!frames || frames.length === 0) {
                                this._sendValidateMessage(tab.id, null, locator, type, matchId, (c) => LocatorX.utils._updateBadge(matchId, c));
                                return;
                            }
                            frames.forEach(frame => {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'evaluateSelector',
                                    selector: locator,
                                    type: type,
                                    enableSmartCorrect: enableSmartCorrect
                                }, { frameId: frame.frameId }, (status) => {
                                    // Accumulate success responses
                                    if (!chrome.runtime.lastError && status) {
                                        if (status.count) totalCount += status.count;
                                        if (status.suggestedLocator) suggestion = status.suggestedLocator;
                                    }

                                    pending--;
                                    if (pending <= 0 && !updated) {
                                        updated = true;
                                        LocatorX.utils._updateBadge(matchId, totalCount);

                                        // Handle Auto-Correction (UI Update)
                                        if (suggestion && suggestion !== locator) {
                                            this._applyAutoCorrection(matchId, suggestion);
                                        }
                                    }
                                });
                            });
                        });
                    }
                });
            });
        },


        _applyAutoCorrection(matchId, suggestion) {
            const badge = document.getElementById(matchId);
            if (!badge) return;
            const row = badge.closest('tr');
            if (row) {
                // MultiScan: Locator is in 4th column (index 3)
                // Main Table: handled differently, but validateMatch is mostly MultiScan context
                if (row.cells[3]) {
                    row.cells[3].textContent = suggestion;

                    // Visual Feedback
                    row.cells[3].style.transition = 'background-color 0.5s';
                    row.cells[3].style.backgroundColor = 'rgba(46, 204, 113, 0.2)'; // Green tint
                    setTimeout(() => {
                        row.cells[3].style.backgroundColor = '';
                    }, 1500);

                    LocatorX.notifications.info(`Auto - corrected to "${suggestion}"`);
                }
            }
        },

        _sendValidateMessage(tabId, frameId, locator, type, matchId, callback) {
            const opts = frameId !== null ? { frameId } : {};
            chrome.tabs.sendMessage(tabId, {
                action: 'evaluateSelector',
                selector: locator,
                type: type
            }, opts, (status) => {
                const count = (!chrome.runtime.lastError && status) ? status.count : 0;
                callback(count);
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

    dropdowns: {
        list: [
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
        lastElementInfo: null,
        lastElementType: null,
        lastMetadata: null,
        showTimestamp: false,

        init() {
            this.setupSelectAll();
            this.setupCheckboxes();
            this.setupRelativeXPath();
            this.setupGeneratorSettings();
            this.setupTimestampSetting();
            this.setupSmartCorrectionSetting();
            this.loadFiltersFromStorage();
            this.saveCurrentFilters('home');
            this.updateTable();
        },

        updateFilterVisibility(tab) {
            const container = document.querySelector('.locator-options');
            if (container) {
                // 1. Setup Scroll Listener (Once)
                if (!container.dataset.hasScrollListener) {
                    container.addEventListener('wheel', (e) => {
                        if (e.deltaY !== 0) {
                            e.preventDefault();
                            container.scrollLeft += e.deltaY;
                        }
                    }, { passive: false });
                    container.dataset.hasScrollListener = 'true';
                }

                // 2. Update Visibility
                if (tab === 'home' || tab === 'pom') {
                    container.classList.remove('hidden');
                    // Ensure all individual filters are visible (reset potentially hidden ones)
                    // We can do this by removing display: none from any labels inside
                    container.querySelectorAll('label').forEach(label => label.style.display = '');
                } else {
                    container.classList.add('hidden');
                }
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

        setupGeneratorSettings() {
            const excludeNumbersCfg = document.getElementById('excludeNumbersCfg');
            if (excludeNumbersCfg) {
                const updateState = () => {
                    chrome.storage.local.get(['excludeNumbers', 'user'], (result) => {
                        const user = result.user || { plan: 'free' };
                        const plan = user.plan || 'free';
                        // Use safe fallback if plans not loaded, otherwise check feature
                        const isAllowed = (typeof LocatorXPlans !== 'undefined') ?
                            LocatorXPlans.FEATURES[plan].includes('ui.settings.excludeNumbers') || LocatorXPlans.FEATURES[plan] === 'ALL' :
                            false; // Default to blocked if unknown

                        if (!isAllowed) {
                            // Enforce default behavior (Exclude = true) and disable
                            excludeNumbersCfg.checked = true;
                            excludeNumbersCfg.disabled = true;
                            excludeNumbersCfg.parentElement.style.opacity = '0.6';
                            excludeNumbersCfg.parentElement.title = 'Upgrade to Pro to customize this setting';
                            this.syncConfigToTab({ excludeNumbers: true });
                        } else {
                            // User allowed, load stored preference
                            const val = result.excludeNumbers !== undefined ? result.excludeNumbers : true;
                            excludeNumbersCfg.checked = val;
                            excludeNumbersCfg.disabled = false;
                            excludeNumbersCfg.parentElement.style.opacity = '1';
                            excludeNumbersCfg.parentElement.title = '';
                            this.syncConfigToTab({ excludeNumbers: val });
                        }
                    });
                };

                // Initial load
                updateState();

                // Listen for changes (User toggles)
                excludeNumbersCfg.addEventListener('change', () => {
                    const val = excludeNumbersCfg.checked;
                    chrome.storage.local.set({ excludeNumbers: val });
                    this.syncConfigToTab({ excludeNumbers: val });
                });

                // Listen for Auth changes (User upgrades/logs and re-enables feature)
                chrome.runtime.onMessage.addListener((message) => {
                    if (message.action === 'AUTH_STATE_CHANGED') {
                        updateState();
                    }
                });
            }
        },

        setupTimestampSetting() {
            const showTimestampCfg = document.getElementById('showTimestampCfg');
            if (showTimestampCfg) {
                const updateState = () => {
                    chrome.storage.local.get(['showTimestamp'], (result) => {
                        const val = result.showTimestamp !== undefined ? result.showTimestamp : false;
                        this.showTimestamp = val;
                        showTimestampCfg.checked = val;
                        this.toggleTimestampColumn(val);
                    });
                };

                updateState();

                showTimestampCfg.addEventListener('change', () => {
                    const val = showTimestampCfg.checked;
                    this.showTimestamp = val;
                    chrome.storage.local.set({ showTimestamp: val });
                    this.toggleTimestampColumn(val);
                });
            }
        },

        toggleTimestampColumn(show) {
            const cells = document.querySelectorAll('.time-column');
            cells.forEach(cell => {
                if (show) cell.classList.remove('hidden');
                else cell.classList.add('hidden');
            });
        },

        setupSmartCorrectionSetting() {
            const smartCorrectCfg = document.getElementById('smartCorrectCfg');
            if (smartCorrectCfg) {
                const updateState = () => {
                    chrome.storage.local.get(['smartCorrectEnabled', 'user'], (result) => {
                        const user = result.user || { plan: 'free' };
                        const plan = user.plan || 'free';

                        // Check if feature is allowed for current plan
                        const isAllowed = (typeof planService !== 'undefined') ?
                            planService.isEnabled('module.smartCorrect') : false;

                        if (!isAllowed) {
                            // Enforce disabled for Free users
                            smartCorrectCfg.checked = false;
                            smartCorrectCfg.disabled = true;
                            smartCorrectCfg.parentElement.style.opacity = '0.6';
                            smartCorrectCfg.parentElement.title = 'Upgrade to Pro to enable Smart Correction';
                        } else {
                            // Pro users: load stored preference (default: true)
                            const val = result.smartCorrectEnabled !== undefined ? result.smartCorrectEnabled : true;
                            smartCorrectCfg.checked = val;
                            smartCorrectCfg.disabled = false;
                            smartCorrectCfg.parentElement.style.opacity = '1';
                            smartCorrectCfg.parentElement.title = 'Automatically suggest corrections for typos in locators';
                        }
                    });
                };

                // Initial load
                updateState();

                // Listen for user toggles
                smartCorrectCfg.addEventListener('change', () => {
                    const val = smartCorrectCfg.checked;
                    chrome.storage.local.set({ smartCorrectEnabled: val });
                });

                // Listen for auth changes (user upgrades/downgrades)
                chrome.runtime.onMessage.addListener((message) => {
                    if (message.action === 'AUTH_STATE_CHANGED') {
                        updateState();
                    }
                });
            }
        },

        syncConfigToTab(config) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'updateConfig',
                        config: config
                    }).catch(() => {
                        // Ignore errors if tab is not ready or content script not loaded
                    });
                }
            });
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
                        const defaultXpath = document.getElementById('relativeXpathLocator');
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



        updateTable() {
            const tbody = document.querySelector('.locator-table tbody');
            if (!tbody) return;

            const checkedTypes = this.getCheckedTypes();
            const enabledIds = this.getEnabledFilterIds();

            // Save enabled filters to storage
            chrome.storage.local.set({ enabledFilters: enabledIds });

            tbody.innerHTML = '';

            const groupedTypes = [
                LocatorXConfig.STRATEGY_NAMES.relativeXpath,
                LocatorXConfig.STRATEGY_NAMES.containsXpath,
                LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.pLinkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                LocatorXConfig.STRATEGY_NAMES.startsWithXpath,
                LocatorXConfig.STRATEGY_NAMES.orXpath,
                LocatorXConfig.STRATEGY_NAMES.cssXpath
            ];

            const standardTypes = checkedTypes.filter(t => !groupedTypes.includes(t));
            const activeGroupedTypes = checkedTypes.filter(t => groupedTypes.includes(t));

            // 1. Render Standard Types (Structure Only)
            standardTypes.forEach(type => {
                const row = document.createElement('tr');
                row.setAttribute('data-type', type);
                row.innerHTML = `
                    <td><span class="match-count" data-count="0"></span></td>
                    <td>${type}</td>
                    <td class="lx-editable" data-target="table-cell" style="color: var(--secondary-text); opacity: 0.5;"></td>
                    <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">-</td>
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

                    valCell.innerHTML = `<span class="locator-wrapper"> <span class="locator-text">${locator.locator}</span>${this._createWarningIcon(locator.warnings)}</span > `;
                    valCell.classList.add('locator-cell');
                    valCell.style.color = '';
                    valCell.style.opacity = '1';

                    // Update Time Cell (4th cell)
                    const timeCell = row.querySelector('.time-column');
                    if (timeCell) timeCell.textContent = this.lastMetadata?.timestamp || '-';

                    actions.forEach(btn => btn.classList.remove('disabled'));
                } else {
                    matchCell.setAttribute('data-count', '0');
                    valCell.textContent = '-';
                    valCell.classList.remove('locator-cell');
                    valCell.style.color = 'var(--secondary-text)';
                    valCell.style.opacity = '0.5';

                    const timeCell = row.querySelector('.time-column');
                    if (timeCell) timeCell.textContent = '-';

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
                    ${this._createMatchCell(locator.matches)}
                    <td>${locator.type}</td>
                    <td class="lx-editable locator-cell" data-target="table-cell">
                        <span class="locator-wrapper">
                            <span class="locator-text">${locator.locator}</span>
                            ${this._createWarningIcon(locator.warnings)}
                        </span>
                    </td>
                    <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">${this.lastMetadata?.timestamp || '-'}</td>
                    ${this._createActionCell(false)}
`;
            } else {
                row.innerHTML = `
                    ${this._createMatchCell(0)}
                    <td>${type}</td>
                    <td class="lx-editable locator-cell lx-text-disabled" data-target="table-cell"></td>
                    <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">-</td>
                    ${this._createActionCell(true)}
`;
            }
            tbody.appendChild(row);
        },

        _createWarningIcon(warnings) {
            if (!warnings || warnings.length === 0) return '';
            const title = warnings.join('\n');
            return `<i class="bi bi-exclamation-circle-fill warning-icon" title = "${title}"></i > `;
        },

        renderGroupRow(tbody, availableTypes, currentType, allLocators) {
            const locator = allLocators.find(l => l.type === currentType);
            const row = document.createElement('tr');
            row.className = 'strategy-row';

            // Match Count
            const matchCount = locator ? locator.matches : '0';

            // Dropdown Options
            const options = availableTypes.map(type => {
                const typeLocator = allLocators.find(l => l.type === type);
                const isDisabled = false; // Always enabled per user request
                return `<option value = "${type}" ${type === currentType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}> ${type}</option > `;
            }).join('');

            const locatorValue = locator ? `<span class="locator-wrapper"> <span class="locator-text">${locator.locator}</span>${this._createWarningIcon(locator.warnings)}</span > ` : '-';
            const locatorStyle = locator ? '' : '';
            const locatorClass = locator ? 'locator-cell' : 'lx-text-disabled';
            const actionClass = locator ? '' : 'disabled';

            row.innerHTML = `
                ${this._createMatchCell(matchCount, 'strategyMatchCount')}
                <td class="strategy-cell">
                    <select id="strategySelect">
                        ${options}
                    </select>
                </td>
                <td class="lx-editable ${locatorClass}" id="strategyLocator" data-target="table-cell" ${locatorStyle}>${locatorValue}</td>
                <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">${this.lastMetadata?.timestamp || '-'}</td>
                ${this._createActionCell(!locator)}
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
                matchBadge.setAttribute('data-count', locator.matches);

                locatorCell.innerHTML = `<span class="locator-wrapper"> <span class="locator-text">${locator.locator}</span>${this._createWarningIcon(locator.warnings)}</span > `;
                locatorCell.classList.add('locator-cell');
                locatorCell.classList.remove('lx-text-disabled');
                locatorCell.style.color = '';
                locatorCell.style.opacity = '';

                actions.forEach(btn => btn.classList.remove('disabled'));
            } else {
                matchBadge.setAttribute('data-count', '0');
                locatorCell.textContent = '-';
                locatorCell.classList.remove('locator-cell');
                locatorCell.classList.add('lx-text-disabled');
                locatorCell.style.color = '';
                locatorCell.style.opacity = '';

                actions.forEach(btn => btn.classList.add('disabled'));
            }
        },

        _createMatchCell(count, id = '') {
            const idAttr = id ? `id = "${id}"` : '';
            return `<td > <span class="match-count" data-count="${count}" ${idAttr}></span></td > `;
        },

        _createActionCell(isDisabled) {
            const cls = isDisabled ? 'disabled' : '';
            return `
    <td >
                    <i class="bi-clipboard ${cls}" title="Copy"></i>
                    <i class="bi-bookmark-plus ${cls}" title="Save"></i>
                </td >
    `;
        },

        displayGeneratedLocators(locators, elementInfo = null, elementType = null, metadata = null) {
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
            this.lastMetadata = metadata;

            if (LocatorX.tabs.current === 'home') {
                // Data Update Only!
                this.updateTableData(locators);
                this.updateElementInfo(elementInfo, elementType, metadata);
            } else if (LocatorX.tabs.current === 'pom') {
                this.handlePOMDisplay(locators, metadata);
            }
        },

        updateElementInfo(info, type, metadata = null) {
            // Update detail text if available
            const detailText = document.getElementById('homeElementDetail');
            if (detailText) {
                if (metadata && metadata.isCrossOrigin) {
                    detailText.innerHTML = `<span style = "color: #e74c3c; font-weight: bold;"> [Security Warning]</span > Element is inside a cross - origin iframe.Browser security blocks access. <br /> <small style="opacity: 0.7;">Only the iframe selector itself can be captured.</small>`;
                } else {
                    detailText.textContent = info || 'No element selected';
                }
            }

            // Update Element Type Badge
            const badge = document.getElementById('elementTypeBadge');
            if (badge) {
                let displayType = type;
                let isDynamic = false;

                if (metadata) {
                    if (metadata.isInIframe) {
                        displayType = metadata.isCrossOrigin ? 'Iframe (Cross-Origin)' : 'Iframe (Captured)';
                    }
                    if (metadata.isDynamic) {
                        isDynamic = true;
                    }
                }

                if (displayType && displayType !== 'Normal') {
                    badge.textContent = displayType;
                    badge.setAttribute('data-type', displayType);
                    badge.classList.remove('hidden');

                    // Reset dynamic styling for standard badge
                    badge.style.background = '';
                    badge.style.color = '';
                } else if (isDynamic) {
                    // Show Dynamic Badge if standard type is normal
                    badge.textContent = 'Dynamic Element';
                    badge.setAttribute('data-type', 'dynamic'); // For CSS styling if needed
                    badge.classList.remove('hidden');

                    // distinct style for dynamic
                    badge.style.background = '#fff3cd'; // Light yellow
                    badge.style.color = '#856404';      // Dark yellow/brown
                    badge.style.border = '1px solid #ffeeba';
                } else {
                    badge.classList.add('hidden');
                }

                // If both (e.g. Iframe + Dynamic), append dynamic warning?
                // For simplicity, Iframe status takes precedence as it affects capture strategy more.
                // But we could append text:
                if (displayType && displayType !== 'Normal' && isDynamic) {
                    badge.textContent += ' (Dynamic)';
                }
            }
        },

        handlePOMDisplay(locators, metadata = null) {
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
                                id: `pom_${Date.now()} `,
                                name: name,
                                locators: []
                            };
                            LocatorX.core.savePOMPage(newPage);
                            LocatorX.pom.loadPages();
                            LocatorX.pom.switchPage(newPage.id);
                            currentPage = newPage;

                            // Now add the locators
                            this.addLocatorsToPage(currentPage, locators, metadata);
                        }
                    });
                return;
            }

            this.addLocatorsToPage(currentPage, locators, metadata);
            this.updatePOMTable();
        },



        addLocatorsToPage(page, locators, metadata = null) {
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


            // Add to storage
            page.locators.push({
                locators,
                timestamp: metadata?.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false })
            });
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
                LocatorXConfig.STRATEGY_NAMES.relativeXpath,
                LocatorXConfig.STRATEGY_NAMES.containsXpath,
                LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.pLinkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                LocatorXConfig.STRATEGY_NAMES.startsWithXpath,
                LocatorXConfig.STRATEGY_NAMES.orXpath,
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

            headerRow.innerHTML += `<th class="time-column ${this.showTimestamp ? '' : 'hidden'}">Time</th>`;
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
                    'relativeXpathLocator': LocatorXConfig.STRATEGY_NAMES.relativeXpath,
                    'containsXpathLocator': LocatorXConfig.STRATEGY_NAMES.containsXpath,
                    'indexedXpathLocator': LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                    'linkTextXpathLocator': LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                    'pLinkTextXpathLocator': LocatorXConfig.STRATEGY_NAMES.pLinkTextXpath,
                    'attributeXpathLocator': LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                    'startsWithXpathLocator': LocatorXConfig.STRATEGY_NAMES.startsWithXpath,
                    'orXpathLocator': LocatorXConfig.STRATEGY_NAMES.orXpath,
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
                        nested.style.top = `${rect.bottom + 2} px`;
                        nested.style.left = `${rect.right - 90} px`; // Align right edge
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
                const container = document.querySelector('.relative-xpath-container');
                if (container && !container.contains(e.target) && !nested.contains(e.target)) {
                    nested.style.display = 'none';
                    arrow.classList.remove('expanded');
                }
            });
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
        manager: null,
        selectedIndex: -1,

        init() {
            if (!this.manager && typeof SuggestionManager !== 'undefined') {
                this.manager = new SuggestionManager();
            }

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

            LocatorX.utils.autoFlip(input, dropdown);

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
            let foundResult = false;

            LocatorX.utils.evaluate(query, {
                badge: badge,
                callback: (totalCount, response) => {
                    if (response && response.count === 1 && !foundResult) {
                        foundResult = true;
                        LocatorX.filters.updateElementInfo(response.elementInfo, response.elementType);
                        if (response.locators) {
                            LocatorX.filters.displayGeneratedLocators(
                                response.locators,
                                response.elementInfo,
                                response.elementType,
                                response.metadata
                            );
                        }
                    }
                    LocatorX.search.finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult);
                }
            });
        },

        finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult) {
            LocatorX.search.renderDropdown(suggestions, query, dropdown, totalCount);

            if (!foundResult && totalCount !== 1) {
                LocatorX.filters.updateElementInfo(null, null);
                LocatorX.filters.displayGeneratedLocators([], null, null, null);
            }
        },

        highlightMatchesInAllFrames(query) {
            LocatorX.utils.highlight(query);
        },

        clearMatchHighlightsInAllFrames() {
            LocatorX.utils.highlight('', 'clearMatchHighlights');
        },

        renderDropdown(matches, query, dropdown, activeMatchCount) {
            dropdown.innerHTML = '';

            // Add "Live Test" item if query looks like a selector
            if (query.length > 2) {
                const liveItem = document.createElement('div');
                liveItem.className = 'dropdown-item live-test-item';
                const countVal = typeof activeMatchCount === 'number' ? activeMatchCount : '...';
                liveItem.innerHTML = `
                    <div class="match-badge" data - count="${countVal}"></div>
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
                // Show category if it's not a standard one
                const categoryInfo = ['Tag', 'ID', 'Class', 'Name'].includes(match.category)
                    ? ''
                    : `<span class="category-tag"> (${match.category})</span > `;

                div.innerHTML = `
    <div class="match-badge" data - count="${match.count}"></div >
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
                        anchorVal.textContent = `Captured: ${message.elementInfo.tagName} `;
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
                        targetVal.textContent = `Captured: ${message.elementInfo.tagName} `;
                        targetVal.style.color = 'var(--text-primary)';
                        targetVal.style.fontWeight = '500';
                    }
                    // Update Result
                    const resultVal = document.getElementById('axesResultValue');
                    const matchBadge = document.getElementById('axesMatchCount');

                    if (resultVal) {
                        resultVal.textContent = message.locator || 'No result found';
                    }

                    if (matchBadge) {
                        if (message.locator) {
                            LocatorX.axes.updateResultMatch(message.locator);
                        } else {
                            matchBadge.setAttribute('data-count', 0);
                        }
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
                // If not in a standard mode, switch to Home first
                const standardModes = ['home', 'pom', 'axes'];
                if (!standardModes.includes(LocatorX.tabs.current)) {
                    LocatorX.tabs.switch('home');
                }
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
                    const plan = (typeof planService !== 'undefined' ? planService.currentPlan : (user.plan || 'free')).toLowerCase();
                    const logoPath = `../../../ assets / icons / ${plan} 48.png`;
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

                        const avatarUrl = user.avatar + (user._lastUpdated ? `? t = ${user._lastUpdated} ` : '');

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
                const planText = (typeof planService !== 'undefined' ? planService.getPlanName() : (user.plan || 'Free')).toUpperCase();
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

                // If history is disabled, clear the dropdown to avoid stale data access
                if (!planService.isEnabled('module.history')) {
                    const historyDropdown = document.getElementById('customDropdown');
                    if (historyDropdown) {
                        const content = historyDropdown.querySelector('.dropdown-content');
                        if (content) content.innerHTML = '<div class="empty-state"><p style="color:var(--secondary-text)">Upgrade to view history</p></div>';
                    }
                }
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

            // CRITICAL: Revert to Free plan features & Enforce Teardown
            if (typeof planService !== 'undefined') {
                planService.applyUIGates();

                // Teardown: If current tab is now disabled, switch home
                const currentTab = LocatorX.tabs.current;
                const featureMap = {
                    'pom': 'module.pom',
                    'axes': 'module.axes',
                    'dynamic': 'module.multiScan' // dynamic view is mainly MultiScan 
                };

                // Check if current tab is restricted
                if (featureMap[currentTab] && !planService.isEnabled(featureMap[currentTab])) {
                    LocatorX.tabs.switch('home');
                    LocatorX.notifications.info('Feature disabled on Free plan');
                }
            }
        },

        login() {
            const baseUrl = LocatorXConfig.AUTH_DOMAIN || 'http://localhost:3000';
            window.open(`${baseUrl} /auth/login`, '_blank');
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
        this.evaluator = new Evaluator();
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
        this.multiScan.init();
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
            notification.className = `notification ${type} `;

            const icons = {
                success: 'bi-check-circle',
                error: 'bi-x-circle',
                warning: 'bi-exclamation-triangle',
                info: 'bi-info-circle'
            };

            notification.innerHTML = `
    <i class="${icons[type] || icons.info}"></i >
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
            if (dropdown) {
                // Remove existing listener
                dropdown.removeEventListener('click', this.handleSavedClick);

                // Add new listener with proper binding
                this.handleSavedClick = (e) => {
                    if (e.target.classList.contains('saved-copy') || e.target.closest('.saved-copy')) {
                        const item = e.target.closest('.saved-item');
                        const locator = item.querySelector('.saved-locator-code').textContent;
                        LocatorX.utils.copyToClipboard(locator).then(success => {
                            if (success) LocatorX.notifications.success('Copied!');
                            else LocatorX.notifications.error('Failed to copy');
                        });
                    }

                    if (e.target.classList.contains('saved-delete') || e.target.closest('.saved-delete')) {
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
                    // FEATURE GATE: Check for Saved Locator Limit
                    if (typeof planService !== 'undefined') {
                        const savedCount = (JSON.parse(localStorage.getItem('locator-x-saved') || '[]')).length;
                        const limit = planService.getLimit('MAX_SAVED_LOCATORS');
                        // Allow saving IF renaming existing (logic below handles find), 
                        // BUT for simplicity, we check absolute count before proceeding.
                        // Precise check: If we are adding NEW, we check limit.
                        // If we are renaming, we don't.

                        // We need the locator to know if it's new or existing logic first?
                        // Let's defer check slightly or check generic limit first.
                        // Ideally we check if it exists:
                        const locatorVal = searchInput.value.trim();
                        const savedItems = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');
                        const exists = savedItems.some(item => item.locator === locatorVal);

                        if (!exists && savedCount >= limit) {
                            planService._showUpgradePrompt('Saved Locator Limit Reached');
                            return;
                        }
                    }

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
                    let locator = '';

                    if (row.closest('#msResultsTable')) {
                        // MultiScan: Locator is in 4th column (index 3)
                        locator = row.cells[3].textContent;
                    } else {
                        // Main Table: Locator is in #strategyLocator or .lx-editable
                        const locatorCell = row.querySelector('#strategyLocator') || row.querySelector('.lx-editable');
                        if (locatorCell) locator = locatorCell.textContent;
                    }

                    if (locator) {
                        LocatorX.utils.copyToClipboard(locator).then(success => {
                            if (success) LocatorX.notifications.success('Locator copied to clipboard');
                            else LocatorX.notifications.error('Failed to copy');
                        });
                    }
                }
                if (e.target.classList.contains('bi-bookmark-plus')) {
                    const row = e.target.closest('tr');
                    const locatorCell = row.querySelector('.lx-editable');
                    const locator = locatorCell.textContent;
                    let type = row.getAttribute('data-type');
                    if (!type) {
                        const strategySelect = row.querySelector('.strategy-dropdown');
                        type = strategySelect ? strategySelect.value : row.cells[1].textContent;
                    }

                    // Save with auto-generated name
                    const savedName = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const saved = JSON.parse(localStorage.getItem('locator-x-saved') || '[]');

                    const isDuplicate = saved.some(item => item.locator === locator && item.type === type);

                    if (isDuplicate) {
                        LocatorX.notifications.warning('Locator already saved');
                        return;
                    }

                    // FEATURE GATE: Check for Saved Locator Limit
                    if (typeof planService !== 'undefined') {
                        const limit = planService.getLimit('MAX_SAVED_LOCATORS');
                        if (saved.length >= limit) {
                            planService._showUpgradePrompt('Saved Locator Limit Reached');
                            return;
                        }
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
                    /* 
                        Logic to update the specific locator in LocatorX.pom.pages[activePage] 
                        would go here. For now, just ensuring the edit "sticks" in UI is the first step.
                    */
                    LocatorX.notifications.success('Locator updated locally');
                } else if (targetType === 'multiscan-cell') {
                    // Real-time update for MultiScan
                    const row = element.closest('tr');
                    const badge = row.querySelector('.match-count');

                    // Column 3 is Type, Column 4 is Locator
                    const type = row.querySelector('td:nth-child(3)').textContent;
                    const locator = row.querySelector('td:nth-child(4)').textContent;

                    if (badge) {
                        badge.dataset.count = '...';
                        LocatorX.multiScan.validateMatch(locator, type, badge.id);
                    }
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
            const originalHTML = cell.innerHTML;
            cell.classList.add('editing');

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue.trim(); // Trim input for better UX

            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            input.select();

            const finishEdit = () => {
                const newValue = input.value; // Allow empty

                // If unchanged, restore original structure (preserves formatting/icons)
                if (newValue === currentValue.trim()) {
                    cell.innerHTML = originalHTML;
                    cell.classList.remove('editing');
                    return;
                }

                cell.textContent = newValue;
                cell.classList.remove('editing');

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
            };

            input.addEventListener('blur', finishEdit);
            let axesEvalTimeout;
            input.addEventListener('input', () => {
                if (cell.dataset.target === 'axes-result') {
                    clearTimeout(axesEvalTimeout);
                    axesEvalTimeout = setTimeout(() => {
                        LocatorX.axes.updateResultMatch(input.value);
                    }, 300);
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEdit();
                if (e.key === 'Escape') {
                    cell.innerHTML = originalHTML;
                    cell.classList.remove('editing');
                }
            });
        },

        updateMatchCount(cell) {
            const row = cell.closest('tr');
            if (!row) return;

            const badge = row.querySelector('.match-badge') || row.querySelector('.match-count');
            const typeCell = row.cells[1];
            const type = typeCell ? typeCell.textContent.trim().toLowerCase() : 'auto';

            LocatorX.utils.evaluate(cell, {
                type: type,
                badge: badge
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