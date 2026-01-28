# Multi-Locator Scanning Capabilities

This document details the code patterns and frameworks currently supported by the Multi-Locator Scan feature.

## Supported Frameworks & Patterns

All frameworks support flexible whitespace (tabs, multiple spaces) and varying quote styles (single or double quotes) thanks to robust regex matching.

### 1. Selenium (Java)
**Patterns Detected:**
- **Standard `@FindBy`**: 
  ```java
  @FindBy(id = "login")
  @FindBy( xpath = "//button" )
  ```
- **Direct & Chained Calls**:
  ```java
  driver.findElement(By.id("submit"));
  driver.findElement(By.id("form")).findElement(By.name("user"));
  ```
- **Waits**:
  ```java
  wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//div")));
  ```

### 2. Selenium (Python)
**Patterns Detected:**
- **Standard**:
  ```python
  driver.find_element(By.ID, "user")
  ```
- **Waits**:
  ```python
  wait.until(EC.presence_of_element_located((By.XPATH, "//modal")))
  ```

### 3. Selenium (JavaScript)
**Patterns Detected:**
- **Async calls**:
  ```javascript
  await driver.findElement(By.id("submit"))
  ```

### 4. Playwright (JS/TS)
**Patterns Detected:**
- **Standard Locator**:
  ```javascript
  page.locator("test-id=submit")
  page.locator("#login") // Support for simple strings
  ```
- **Frame Locators**:
  ```javascript
  page.frameLocator("#iframe")
  ```
- **User-Visible Locators**:
  ```javascript
  page.getByRole("button")
  page.getByText("Login")
  ```

### 5. Playwright (Python)
**Patterns Detected:**
- **Standard Locator**:
  ```python
  page.locator("#login")
  ```
- **Sync Actions**:
  ```python
  page.click("#submit")
  page.fill("#name", "Test")
  ```

### 6. Playwright (Java)
**Patterns Detected:**
- **Standard Locator**:
  ```java
  page.locator("#login")
  ```
- **Sync Actions**:
  ```java
  page.click("#submit")
  ```

### 7. Cypress
**Patterns Detected:**
- **Standard `cy.get`**:
  ```javascript
  cy.get("#main")
  cy.get(".item")
  ```
- **Commands**:
  ```javascript
  cy.contains("Submit")
  ```

## Other Features
- **Flexible Whitespace**: The scanner ignores extra spaces around parentheses, commas, and quotes.
- **Quote Insensitivity**: Supports both single `'` and double `"` quotes.
- **Duplicate Prevention**: Automatically de-duplicates locators if matched by multiple patterns (e.g., generic vs specific).
