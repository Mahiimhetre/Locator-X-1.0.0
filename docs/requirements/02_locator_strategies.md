# Locator Generation Strategies

## 1. Supported Strategies
*   **Basic**: ID, Name, Class Name, Tag Name, Link Text, Partial Link Text.
*   **CSS**: Optimized, shortest unique paths.
*   **XPath**: Simple attribute-based (e.g., `//tag[@attr='val']`).
*   **Specialized**: JS Path (`document.querySelector`).

## 2. Priority & Filtering
*   **Priority Attributes**: `data-testid`, `data-cy`, `id`, `name`.
*   **Cleanliness Policy**: Filter out "ugly" or excessively long locators (e.g., deep absolute paths) if better unique alternatives exist.
*   **Uniqueness**: All generated locators must be validated against the current DOM.

## 3. Framework Settings
*   Logic adjusts based on global framework (Selenium, Playwright, Cypress).
*   Certain types may be disabled/enabled based on framework recommendations.
