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
    
    // Set active tab and show content
    if (tab === 'home') {
        document.getElementById('navHome').classList.add('active');
        document.querySelector('.home-container').classList.add('active');
        currentActiveTab = 'home';
    } else if (tab === 'pom') {
        document.getElementById('navPOM').classList.add('active');
        document.querySelector('.pom-content').classList.add('active');
        currentActiveTab = 'pom';
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