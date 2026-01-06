/**
 * Unit Test for PlanService
 * 
 * Mocks the Chrome API and verifies plan-based gating logic.
 * Run with: node src/tests/plan-service.test.js
 */

// 1. Mock Global State
global.chrome = {
    storage: {
        local: {
            get: (keys, cb) => cb({ 'locator-x-plan': 'free' }),
            onChanged: { addListener: () => { } }
        },
        onChanged: { addListener: () => { } }
    }
};

global.LocatorXPlans = require('../config/plans.js');
const PlanService = require('../services/plan-service.js');

// 2. Test Runner Helpers
const suites = [];
const test = (name, fn) => suites.push({ name, fn });
const assert = (condition, msg) => {
    if (!condition) throw new Error(`[FAIL] ${msg}`);
};

// 3. Define Tests
test('Should default to free plan', async () => {
    const service = new PlanService();
    await service.init();
    assert(service.currentPlan === 'free', 'Default plan is not free');
    assert(service.getPlanName() === 'Free', 'Friendly name incorrect');
});

test('Should enable free features for free plan', async () => {
    const service = new PlanService();
    await service.init();
    assert(service.isEnabled('locator.id') === true, 'locator.id should be enabled');
    assert(service.isEnabled('locator.xpath') === false, 'locator.xpath should be disabled');
});

test('Should respect numeric limits', async () => {
    const service = new PlanService();
    await service.init();
    assert(service.getLimit('MAX_SAVED_LOCATORS') === 25, 'Free limit should be 25');
});

test('Should enable pro features for pro plan', async () => {
    const service = new PlanService();
    // Simulate plan upgrade
    service.updatePlan('pro');
    assert(service.currentPlan === 'pro', 'Plan update failed');
    assert(service.isEnabled('locator.xpath') === true, 'locator.xpath should be enabled in Pro');
    assert(service.getLimit('MAX_SAVED_LOCATORS') === Infinity, 'Pro limit should be Infinity');
});

test('Should grant ALL access to team plan', async () => {
    const service = new PlanService();
    service.updatePlan('team');
    assert(service.isEnabled('anything.at.all') === true, 'Team should have ALL access');
});

// 4. Execute
async function runTests() {
    console.log('\n--- Running PlanService Unit Tests ---');
    let passed = 0;
    for (const { name, fn } of suites) {
        try {
            await fn();
            console.log(`✅ PASSED: ${name}`);
            passed++;
        } catch (err) {
            console.log(`❌ FAILED: ${name}`);
            console.error(err.message);
        }
    }
    console.log(`\nResult: ${passed}/${suites.length} tests passed.\n`);
}

runTests();
