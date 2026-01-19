# LocatorX - Browser Extension

A powerful and professional browser extension for generating, managing, and synchronizing web element locators for modern test automation.

## 📁 Project Structure

```
Locator-X-1.0.0/
├── manifest.json           # Extension configuration (MV3)
├── src/
│   ├── background/         # Service worker and authentication bridge
│   ├── config/             # Centralized configuration
│   │   ├── constants.js    # System-wide keys, versions, and limits
│   │   └── plans.js        # Immutable tier definitions (Free, Pro, Team)
│   ├── services/           # Core business logic
│   │   ├── plan-service.js # Reactive feature gating and plan management
│   │   ├── locator-generator.js # Strategy-based locator generation
│   │   ├── storage-manager.js # Persistent data abstraction
│   │   ├── locator-x-core.js # Main orchestrator API

│   ├── ui/                 # User Interface layer
│   │   ├── sidepanel/      # Side panel specific HTML/CSS
│   │   ├── devtools/       # DevTools integration
│   │   └── shared/         # Common controllers and themes
│   │       ├── panel-controller.js # Main UI state management
│   │       └── theme.css   # Dynamic theme definitions
│   └── content/            # In-page scripts
│       ├── domScanner.js   # Element detection and highlighting
│       └── auth-sync.js    # Website-to-extension auth sync
└── assets/                 # Brand assets and optimized icons
```

## 📋 Key service Modules

### **Configuration & Tiers**
- **`src/config/plans.js`**: Defines the "Free", "Pro", and "Team" plans with specific feature flags and usage limits.
- **`src/config/constants.js`**: A single source of truth for storage keys, framework settings, and versioning.

### **Core Services**
- **`plan-service.js`**: Our security and gating layer. It listens for plan changes in real-time and automatically locks/unlocks UI features using `data-feature` attributes.
- **`locator-generator.js`**: Generates 15+ types of locators (XPath, CSS, ID, etc.) with real-time match validation.
- **`storage-manager.js`**: Handles browser storage operations with clean abstraction, supporting saved locators, history, and user settings.

### **UI & Branding**
- **`panel-controller.js`**: A unified controller that manages the complex state of the extension, from authentication views to dynamic avatar fallbacks.
- **Initials-based Avatars**: Automatically generates professional colored initials circles (e.g., "M" for Mahii) when no profile photo is available, matching the website's professional look.
- **Dynamic Header**: The extension logo dynamically updates to show "Pro" or "Team" badges based on the active subscription.

## 🎯 Features

### **Intelligent Generation**
- Supported strategies: ID, Name, CSS, XPath (Absolute/Relative), Contains, Link Text, and more.
- Built-in validation: Every locator is instantly tested against the live DOM to show match counts.

### **User Tiering & Feature Gating**
- **Free**: Basic locators, standard history, and single POM page.
- **Pro**: Advanced locators (Relative XPath, POM), extended history, and AI-powered suggestions.
- **Team**: Collaborative features and team-wide locator synchronization.

### **Framework Compatibility**
- **Selenium**: Full locator support and Java/Python/JS exports.
- **Playwright**: Modern CSS and XPath focus.
- **Cypress**: Optimized for `cy.get` and `cy.xpath` patterns.

## 🚀 Usage

1. **Install**: Load the project folder in `chrome://extensions/` via **Load Unpacked**.
2. **Inspect**: Click the inspect icon and hover over any element on a website.
3. **Capture**: Click the element to generate all available locators.
4. **Organize**: Save locators to "Home" or organize them into "POM" pages for structured test suites.

## 🔧 Development

- **Services**: All business logic should reside in `src/services/` and be documented in their respective classes.
- **Transitions**: UI updates are reactive; changing the plan in `chrome.storage.local` will instantly refresh the extension gates.
- **Testing**: Use the provided unit tests in `src/tests/` to verify plan logic.

## 📦 Dependencies

- **Pure JavaScript**: Zero external runtime dependencies for maximum performance and security.
- **Bootstrap Icons**: Lightweight icon system for professional UI feedback.