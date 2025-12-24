# Locator-X 1.0.0 - Browser Extension

A powerful browser extension for generating and managing web element locators for test automation.

## 📁 Project Structure

```
Locator-X-1.0.0/
├── manifest.json           # Extension configuration
├── assets/                 # Static resources
│   └── default.jpg        # Default icon/logo
├── sidepanel/             # Extension UI (Sidepanel)
│   ├── panel.html         # Main UI structure
│   ├── panel.css          # UI styling
│   ├── panel.js           # UI logic and event handling
│   ├── theme.css          # Theme definitions
│   └── svg-icons.css      # SVG icon styles
├── content/               # Content Scripts
│   └── domScanner.js      # DOM element detection and scanning
├── core/                  # Backend Logic (Reusable)
│   ├── locator-generator.js  # Locator generation algorithms
│   ├── storage-manager.js    # Data persistence layer
│   ├── filter-manager.js     # Filter rules and validation
│   └── locator-x-core.js     # Main API combining all modules
└── devtools/              # DevTools Integration
    └── devtools.js        # DevTools panel logic
```

## 📋 File Descriptions

### **Core Files**

#### `manifest.json`
- **Purpose**: Extension configuration and permissions
- **Contains**: Metadata, permissions, content scripts, sidepanel config
- **Key Features**: Defines extension entry points and capabilities

### **UI Layer (`/sidepanel/`)**

#### `panel.html`
- **Purpose**: Main user interface structure
- **Contains**: HTML layout for sidepanel UI
- **Features**: 
  - Navigation tabs (Home/POM)
  - Filter controls and settings
  - Locator tables and search interface
  - Dropdown menus and notifications

#### `panel.css`
- **Purpose**: Complete UI styling and layout
- **Contains**: CSS variables, component styles, responsive design
- **Features**:
  - Dark/light theme support
  - Table styling and animations
  - Dropdown and modal styles
  - Footer and navigation styling

#### `panel.js`
- **Purpose**: UI logic and event handling (Single UI controller)
- **Contains**: All user interaction logic
- **Features**:
  - Tab switching and navigation
  - Filter management and validation
  - Table updates and data display
  - Settings synchronization
  - Notification system
  - Theme toggling with rotation animation

#### `theme.css`
- **Purpose**: Theme definitions and color schemes
- **Contains**: CSS custom properties for theming
- **Features**: Light/dark mode color variables

#### `svg-icons.css`
- **Purpose**: SVG icon styling (Bootstrap Icons replacement)
- **Contains**: Icon positioning and hover effects
- **Features**: Self-contained icons without external dependencies

### **Content Scripts (`/content/`)**

#### `domScanner.js`
- **Purpose**: Web page element detection and real-time locator generation
- **Contains**: DOM scanning with integrated core logic
- **Features**:
  - **Element Highlighting**: Blue outline on hover
  - **Interactive Tooltip**: Shows element info (tag, id, class)
  - **Click Selection**: Generates locators based on enabled filters
  - **Dynamic Generation**: Uses LocatorGenerator for all 15+ locator types
  - **Filter Integration**: Requests enabled filters from sidepanel
  - **Real-time Validation**: Shows actual match counts for each locator
  - **Escape Key**: Exit scanning mode
  - **Messaging**: Sends generated locators to sidepanel

### **Backend Core (`/core/`)**

#### `locator-generator.js`
- **Purpose**: Comprehensive locator generation for all filter types
- **Contains**: Strategy pattern with 15+ locator generation methods
- **Features**:
  - **Basic Locators**: ID, Name, ClassName, TagName, CSS, LinkText, Partial LinkText
  - **Absolute XPath**: Full DOM path generation
  - **Relative XPath Variants**: Standard, Contains, Indexed, Link Text, Attribute, CSS XPath
  - **Smart Generation**: Framework-aware locator creation
  - **Match Counting**: XPath and CSS selector validation
  - **Filter Integration**: Maps UI checkboxes to generation strategies

#### `storage-manager.js`
- **Purpose**: Data persistence and storage management
- **Contains**: LocalStorage abstraction layer
- **Features**:
  - Saved locators CRUD operations
  - Settings management
  - Filter state persistence
  - History tracking
  - Theme preferences

#### `filter-manager.js`
- **Purpose**: Filter rules and framework compatibility
- **Contains**: Business logic for locator filtering
- **Features**:
  - Framework-specific rules (Selenium, Playwright, Cypress)
  - Language preferences (Python, Java, JavaScript)
  - Filter validation and recommendations
  - Dependency conflict resolution

#### `locator-x-core.js`
- **Purpose**: Main API combining all backend modules
- **Contains**: Unified interface for all core functionality
- **Features**:
  - Centralized API for UI layer
  - Module coordination
  - Data flow management
  - Export/import functionality

### **DevTools Integration (`/devtools/`)**

#### `devtools.js`
- **Purpose**: Browser DevTools panel integration
- **Contains**: DevTools-specific logic and UI
- **Features**: Alternative interface for developer tools

## 🔄 Data Flow

1. **Element Selection**: `domScanner.js` → User clicks element
2. **Filter Request**: Content script requests enabled filters from sidepanel
3. **Locator Generation**: `LocatorGenerator` creates locators for enabled types
4. **Validation**: Match counting for each generated locator
5. **UI Update**: `panel.js` displays real locators in tables
6. **User Actions**: Copy, save, or edit generated locators
7. **Persistence**: `storage-manager.js` saves data locally

## 🎯 Key Features

### **Locator Types Supported**
- **ID**: `#element-id`
- **Name**: `[name="element-name"]`
- **ClassName**: `.class-name`
- **TagName**: Basic HTML tags
- **CSS Selector**: Complex CSS paths
- **LinkText**: For anchor elements
- **Partial LinkText**: Partial anchor text matching
- **Absolute XPath**: Full DOM path from root
- **Relative XPath**: Attribute-based XPath
- **Contains XPath**: Text content matching
- **Indexed XPath**: Position-based selection
- **Link Text XPath**: XPath for anchor text
- **Partial Link XPath**: XPath for partial anchor text
- **Attribute XPath**: Test attribute-based XPath
- **CSS XPath**: Hybrid CSS-XPath approach

### **Framework Support**
- **Selenium**: Full locator support
- **Playwright**: CSS and XPath focus
- **Cypress**: Limited LinkText support

### **UI Features**
- **Dual Tabs**: Home (locator generation) and POM (page object model)
- **Filter System**: Enable/disable locator types
- **Theme Toggle**: Light/dark mode with rotation animation
- **Saved Locators**: Persistent storage with copy/delete
- **Settings**: Framework and language preferences
- **Notifications**: Success/error feedback

## 🚀 Usage

1. **Install Extension**: Load in Chrome/Edge developer mode
2. **Open Sidepanel**: Click extension icon
3. **Start Scanning**: Click inspect button
4. **Select Elements**: Click on webpage elements
5. **Manage Locators**: Copy, save, or organize in tables
6. **Configure**: Set framework/language preferences

## 🔧 Development

- **UI Only**: Modify `panel.js` for interface changes
- **Backend Logic**: Use `/core/` modules for business logic
- **Element Detection**: Enhance `domScanner.js` for better scanning
- **Styling**: Update `panel.css` for visual changes

## 📦 Dependencies

- **Bootstrap Icons**: For UI icons (can be replaced with SVG)
- **Chrome Extension APIs**: For browser integration
- **No External Libraries**: Pure JavaScript implementation