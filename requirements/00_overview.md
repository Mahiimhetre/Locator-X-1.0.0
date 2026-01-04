# Locator-X Project Overview

## 1. Description
**Locator-X** (Temporary Name) is a Chrome browser extension designed to assist test automation engineers working with **Selenium, Playwright, and Cypress**. It automatically generates and manages web element locators, provides a visual inspector, and POM management capabilities.

## 2. Technical Stack
*   **Platform**: Google Chrome Extension (Manifest V3).
*   **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3.
*   **Architecture**:
    *   `manifest.json`: Configuration.
    *   `background.js`: Service worker for context menus and global state orchestration.
    *   `content/`: Scripts (`domScanner.js`) for DOM access.
    *   `sidepanel/`: UI logic (`panel.js`, `panel.html`).
    *   `core/`: Shared logic (`locator-generator.js`).
*   **Storage**: `chrome.storage.local`.

## 3. Non-Functional Requirements
*   **Performance**: Asynchronous locator generation, no page lag.
*   **Usability**: Clean, responsive UI with immediate feedback.
*   **Security**: Minimal permissions; isolation from host page events.
