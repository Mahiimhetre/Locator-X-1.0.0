
const fs = require('fs');

// Mock window
global.window = {};

// Read the manager file
const managerCode = fs.readFileSync('./src/services/multi-scan-manager.js', 'utf8');
eval(managerCode);

const MultiScanManager = global.window.MultiScanManager;
const manager = new MultiScanManager();

function testFramework(name, content, expectedCount) {
    console.log(`Testing ${name}...`);
    const results = manager.autoScan(content, name);
    if (results.length === expectedCount) {
        console.log(`PASS: Found ${results.length} locators.`);
    } else {
        console.log(`FAIL: Expected ${expectedCount}, found ${results.length}.`);
        results.forEach(r => console.log(`  - Found: ${r.type} -> ${r.locator}`));
    }
    console.log('---');
}

// 1. Selenium Java
testFramework('selenium-java', `
    @FindBy( id = "login" )
    WebElement login;
    
    // Chains & Waits
    driver.findElement(By.id("form")).findElement(By.name("username"));
    wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//div")));
`, 4);

// 2. Selenium Python
testFramework('selenium-python', `
    driver.find_element(By.ID, "user")
    
    # Chains/Waits
    wait.until(EC.presence_of_element_located((By.XPATH, "//modal")))
`, 2);

// 3. Selenium JS
testFramework('selenium-js', `
    await driver.findElement(By.id("submit"))
    await driver.findElement(  By.css (  ".btn"  )  )
`, 2);

// 4. Playwright JS
testFramework('playwright-js', `
    page.locator("test-id=submit")
    page.locator("#generic-locator")  // New generic case
    page.getByRole("button")
    
    // Frames
    page.frameLocator("#iframe").locator("#btn")
    
    // Text
    await page.getByText("Login")
`, 5);

// 5. Playwright Python
testFramework('playwright-python', `
    page.locator("test-id=submit")
    page.click("#login")
`, 2);

// 6. Playwright Java
testFramework('playwright-java', `
    page.locator("test-id=submit")
    page.click("#login")
`, 2);

// 7. Cypress
testFramework('cypress', `
    cy.get("#main")
    cy.get(  ".item"  )
    cy.contains("Submit")
    cy.get("@alias") // Alias check
`, 4);
