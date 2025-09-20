// Global tab management
let currentActiveTab = 'home';

// Global functions for tab switching
window.switchToHome = function() {
    setActiveTab('home');
};

window.switchToPOM = function() {
    setActiveTab('pom');
};

window.getCurrentTab = function() {
    return currentActiveTab;
};

function setActiveTab(tab) {
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
        currentActiveTab = 'home';
        if (scopeIcon && scopeText) {
            scopeIcon.className = 'bi-house';
            scopeText.textContent = 'Home';
        }
    } else if (tab === 'pom') {
        document.getElementById('navPOM').classList.add('active');
        document.querySelector('.pom-content').classList.add('active');
        currentActiveTab = 'pom';
        if (scopeIcon && scopeText) {
            scopeIcon.className = 'bi-diagram-3';
            scopeText.textContent = 'POM';
        }
    }
}

// Initialize tabs when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set Home as default active tab
    setActiveTab('home');
    
    // Add click event listeners
    document.getElementById('navHome').addEventListener('click', () => switchToHome());
    document.getElementById('navPOM').addEventListener('click', () => switchToPOM());
});



// Theme management
let currentTheme = 'light';

// Global theme functions
window.toggleTheme = function() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    saveTheme(currentTheme);
};

window.getCurrentTheme = function() {
    return currentTheme;
};

function applyTheme(theme) {
    const body = document.body;
    
    if (theme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
    }
}

function saveTheme(theme) {
    localStorage.setItem('locator-x-theme', theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('locator-x-theme');
    currentTheme = savedTheme || 'light';
    applyTheme(currentTheme);
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
    
    // Add click event listener to theme button
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
});


// Dropdown management
document.addEventListener('DOMContentLoaded', function() {
    const dropdowns = [
        { btn: 'navFilterButton', dropdown: 'filterDropdown' },
        { btn: 'navMultiSelect', dropdown: 'multiSelectDropdown' },
        { btn: 'navAbout', dropdown: 'aboutDropdown' },
        { btn: 'navCustom', dropdown: 'customDropdown' },
        { btn: 'navSettings', dropdown: 'settingsDropdown' }
    ];

    dropdowns.forEach(({ btn, dropdown }) => {
        const btnElement = document.getElementById(btn);
        const dropdownElement = document.getElementById(dropdown);

        if (btnElement && dropdownElement) {
            btnElement.addEventListener('click', function() {
                // Close all other dropdowns
                dropdowns.forEach(({ dropdown: otherDropdown }) => {
                    if (otherDropdown !== dropdown) {
                        const otherElement = document.getElementById(otherDropdown);
                        if (otherElement) otherElement.style.display = 'none';
                    }
                });
                
                const isVisible = dropdownElement.style.display === 'block';
                dropdownElement.style.display = isVisible ? 'none' : 'block';
            });

            dropdownElement.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        const isNavItem = e.target.closest('.nav-item');
        if (!isNavItem) {
            dropdowns.forEach(({ dropdown }) => {
                const dropdownElement = document.getElementById(dropdown);
                if (dropdownElement) dropdownElement.style.display = 'none';
            });
        }
    });

    // Checkbox functionality
    const selectAllCheckbox = document.getElementById('locTypeAll');
    const locTypeCheckboxes = document.querySelectorAll('.loc-type');
    const nestedLocTypeCheckboxes = document.querySelectorAll('.nested-loc-type');
    const allCheckboxes = document.querySelectorAll('.loc-type, .nested-loc-type');

    // Relative XPath dropdown functionality
    const relativeXPathCheckbox = document.getElementById('relativeXPath');
    const relativeXPathNested = document.getElementById('relativeXPathNested');
    const relativeDropdownArrow = document.getElementById('relativeDropdownArrow');

    // Toggle nested options when clicking on Relative XPath or arrow
    function toggleRelativeXPathNested() {
        const isVisible = relativeXPathNested.style.display === 'block';
        relativeXPathNested.style.display = isVisible ? 'none' : 'block';
        relativeDropdownArrow.classList.toggle('expanded', !isVisible);
    }

    if (relativeXPathCheckbox && relativeDropdownArrow) {
        relativeDropdownArrow.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleRelativeXPathNested();
        });

        // Show nested options when Relative XPath is checked
        relativeXPathCheckbox.addEventListener('change', function() {
            if (this.checked) {
                relativeXPathNested.style.display = 'block';
                relativeDropdownArrow.classList.add('expanded');
            } else {
                // Uncheck all nested options when Relative XPath is unchecked
                nestedLocTypeCheckboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
            }
        });
    }

    // Select All functionality
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            
            // Show/hide nested options based on Relative XPath state
            if (relativeXPathCheckbox && relativeXPathCheckbox.checked) {
                relativeXPathNested.style.display = 'block';
                relativeDropdownArrow.classList.add('expanded');
            }
        });
    }

    // Individual checkbox functionality
    allCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
            const noneChecked = Array.from(allCheckboxes).every(cb => !cb.checked);
            
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allChecked;
                selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
            }
        });
    });

    // Nested checkbox functionality - update parent Relative XPath checkbox
    nestedLocTypeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const anyNestedChecked = Array.from(nestedLocTypeCheckboxes).some(cb => cb.checked);
            
            if (relativeXPathCheckbox) {
                // If any nested option is checked, ensure Relative XPath is checked
                if (anyNestedChecked && !relativeXPathCheckbox.checked) {
                    relativeXPathCheckbox.checked = true;
                }
                // If no nested options are checked, uncheck Relative XPath
                else if (!anyNestedChecked && relativeXPathCheckbox.checked) {
                    relativeXPathCheckbox.checked = false;
                }
            }
        });
    });

    // Prevent nested options from closing when clicking inside
    if (relativeXPathNested) {
        relativeXPathNested.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    // Target scope switch functionality
    const switchScopeBtn = document.getElementById('switchScopeBtn');
    const scopeIcon = document.getElementById('scopeIcon');
    const scopeText = document.getElementById('scopeText');
    
    if (switchScopeBtn) {
        switchScopeBtn.addEventListener('click', function() {
            const currentTab = getCurrentTab();
            if (currentTab === 'home') {
                switchToPOM();
                scopeIcon.className = 'bi-diagram-3';
                scopeText.textContent = 'POM';
            } else {
                switchToHome();
                scopeIcon.className = 'bi-house';
                scopeText.textContent = 'Home';
            }
        });
    }

    // Global click outside functionality for nested options
    document.addEventListener('click', function(e) {
        const relativeXPathContainer = document.querySelector('.relative-xpath-container');
        const relativeXPathNested = document.getElementById('relativeXPathNested');
        const relativeDropdownArrow = document.getElementById('relativeDropdownArrow');
        
        if (relativeXPathContainer && relativeXPathNested && !relativeXPathContainer.contains(e.target)) {
            relativeXPathNested.style.display = 'none';
            if (relativeDropdownArrow) {
                relativeDropdownArrow.classList.remove('expanded');
            }
        }
    });
});