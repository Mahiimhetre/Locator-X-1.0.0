# Locator-X Chrome Extension Requirements

## 1. Project Overview
**Locator-X** is a Chrome browser extension designed to assist test automation engineers (Selenium, Playwright, Cypress) by automatically generating and managing robust web element locators. It provides a visual inspector, a comprehensive side panel interface, and Page Object Model (POM) management capabilities.

## 2. Core Functional Requirements

### 2.1. Element Inspection & Scanning
*   **Visual Inspector**:
    *   The extension shall allow users to toggle an "Inspect" mode.
    *   When active, hovering over web elements highlights them with an overlay.
    *   The overlay shall display basic element information (tag, ID, class).
    *   Scanning shall be performant and not degrade page responsiveness.
    *   Support for `Esc` key to exit inspection mode.
*   **Locator Generation**:
    *   Upon clicking an element in Inspect mode, the system shall generate multiple unique locators for that element.
    *   The system shall validate each locator by counting the number of matches in the current DOM (uniqueness check).

### 2.2. Locator Generation Strategies
The system must support the following locator strategies:
*   **Basic**: ID, Name, Class Name, Tag Name, Link Text, Partial Link Text.
*   **CSS Selectors**: Smart CSS paths, optimized for readability and robustness.
*   **XPath**: Relative XPath, Absolute XPath, Contains Text XPath, Indexed XPath, Attribute-based XPath.
*   **Specialized**: JS Path (`document.querySelector`).
*   **Framework Specifics**: Logic to enable/disable specific types based on selected framework (e.g., Cypress vs Playwright preferences).

### 2.3. Side Panel Interface
The extension shall use the Chrome Side Panel API for its primary UI.
*   **Home Tab (Inspector View)**:
    *   Display a table of generated locators for the currently selected element.
    *   Columns: Match Count (color-coded for uniqueness), Type, Locator String, Actions (Copy, Save).
    *   Ability to filter which locator types are generated/displayed.
*   **POM Tab (Page Object Model)**:
    *   Manage collections of locators grouped by "Pages".
    *   Allow creating, renaming, and deleting Pages.
    *   Allow adding selected locators from the Home tab to a specific Page.
    *   Export functionality (implied by "Copy" features, effectively copying POM structures).

### 2.4. Context Menu Integration
*   The extension shall add a "Locator-X" entry to the browser context menu (right-click).
*   Sub-menus shall allow quick copying of specific locator types (e.g., "Copy ID", "Copy Relative XPath") without opening the side panel.
*   Status feedback via notifications when a locator is copied.

### 2.5. Configuration & Settings
*   **Filters**: Users can toggle which locator strategies are active to reduce noise.
*   **Theme**: Support for Light and Dark modes, persisting user preference.
*   **Framework Selection**: Dropdown to select target framework (e.g., Selenium, Cypress, Playwright) which may influence locator generation rules.

## 3. Non-Functional Requirements
*   **Performance**: Locator generation must be asynchronous and debounced to prevent UI freezing.
*   **Usability**: The UI must be clean, responsive, and provide immediate feedback (e.g., copy success).
*   **Security**: Minimal permissions (ActiveTab, Storage, etc.) as defined in Manifest V3. Content injection must not interfere with host page functionality (e.g., event propagation isolation).
*   **Compatibility**: Must function on valid HTML pages and handle dynamic content updates.

## 4. Technical Stack
*   **Platform**: Google Chrome Extension (Manifest V3).
*   **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3.
*   **Architecture**:
    *   `manifest.json`: Configuration.
    *   `background.js`: Service worker for context menus and global state orchestration.
    *   `content/`: Scripts (`domScanner.js`) running in the context of web pages for DOM access.
    *   `sidepanel/`: UI logic (`panel.js`, `panel.html`) for user interaction.
    *   `core/`: Shared logic (`locator-generator.js`) for pure algorithm implementations.
*   **Storage**: `chrome.storage.local` for persisting settings, POM data, and user preferences.

**exporting**:  this is very big plan i need more time till then i'll tell you which things i remember: 1. it should be support export out format(json,xml,and some languages like java,python,js and ts), 2. it should 2 options export as pom like i know java so jaa support normal element finding and opm element finding logics for other langugae i dont know you have to reerch for it. 3. it should support one file export or multi file export, 3. the fil should be editable before exporting, 4. for free user it should be limited to just export in json and xml what you thing still i wanted to discus 
