# Element Inspection & Scanning

## 1. Visual Inspector
*   **Toggle**: Activated via UI button or `Alt + X` shortcut.
*   **Overlay**: Non-intrusive sticky overlay (preprints DOM pollution).
*   **Display**: Shows tag name, ID, and Class in a tooltip.
*   **Isolation**: Must not interfere with host page click/hover events unless capturing.

## 2. Interaction Logic
*   **Home Tab**: Deactivates automatically after one successful click/capture.
*   **POM Tab**: Remains active for bulk-adding multiple elements.
*   **Exit Conditions**: `Esc` key or `Right-Click` clears highlights and stops inspection.

## 3. Context Menu
*   Right-click on any page element provides a "Locator-X" menu.
*   Allows quick copying of individual locator types (ID, Name, XPath, etc.) directly.
