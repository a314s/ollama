/**
 * Navigation functionality for the NaviTechAid Web UI
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Setting up navigation...");
    
    // Set up sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    console.log(`Found ${navItems.length} navigation items`);
    
    if (navItems.length === 0) {
        console.error("No navigation items found. Check the HTML structure.");
        return;
    }
    
    // Add click event listeners to all navigation items
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            console.log(`Navigation item clicked: ${page}`);
            
            if (page) {
                // Hide all pages
                document.querySelectorAll('.page').forEach(p => {
                    p.classList.remove('active');
                });
                
                // Show the selected page
                const pageElement = document.getElementById(`${page}-page`);
                if (pageElement) {
                    pageElement.classList.add('active');
                    console.log(`Page ${page} activated`);
                } else {
                    console.error(`Page element not found: ${page}-page`);
                }
                
                // Update navigation
                document.querySelectorAll('.nav-item').forEach(navItem => {
                    navItem.classList.remove('active');
                });
                
                // Add active class to clicked item
                this.classList.add('active');
                
                // Update URL hash
                window.location.hash = page;
                
                // Perform page-specific actions
                handlePageChange(page);
            }
        });
    });
    
    // Handle initial page based on URL hash
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(`${hash}-page`)) {
        // Show the page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        const pageElement = document.getElementById(`${hash}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
            console.log(`Initial page ${hash} activated`);
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(navItem => {
            navItem.classList.remove('active');
        });
        
        const navItem = document.querySelector(`.nav-item[data-page="${hash}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
        
        handlePageChange(hash);
    } else {
        // Default to chat page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        const chatPage = document.getElementById('chat-page');
        if (chatPage) {
            chatPage.classList.add('active');
            console.log('Default page (chat) activated');
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(navItem => {
            navItem.classList.remove('active');
        });
        
        const chatNavItem = document.querySelector('.nav-item[data-page="chat"]');
        if (chatNavItem) {
            chatNavItem.classList.add('active');
        }
        
        handlePageChange('chat');
    }
    
    // Handle hash change
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(`${hash}-page`)) {
            // Show the page
            document.querySelectorAll('.page').forEach(p => {
                p.classList.remove('active');
            });
            
            const pageElement = document.getElementById(`${hash}-page`);
            if (pageElement) {
                pageElement.classList.add('active');
                console.log(`Hash change: page ${hash} activated`);
            }
            
            // Update navigation
            document.querySelectorAll('.nav-item').forEach(navItem => {
                navItem.classList.remove('active');
            });
            
            const navItem = document.querySelector(`.nav-item[data-page="${hash}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
            
            handlePageChange(hash);
        }
    });
    
    /**
     * Handle page-specific actions when changing pages
     * @param {string} page - The page to show
     */
    function handlePageChange(page) {
        console.log(`Handling page change: ${page}`);
        
        // Check connection when changing pages
        if (window.connectionManager) {
            window.connectionManager.checkConnection();
        }
        
        // Page-specific actions
        switch (page) {
            case 'chat':
                // Refresh models when navigating to chat page
                if (window.chatManager) {
                    window.chatManager.loadModels();
                }
                break;
                
            case 'documents':
                // Refresh documents when navigating to documents page
                if (window.documentsManager) {
                    window.documentsManager.loadDocuments();
                }
                break;
                
            case 'models':
                // Refresh models when navigating to models page
                if (window.modelsManager) {
                    window.modelsManager.loadModels();
                }
                break;
                
            case 'settings':
                // Refresh settings when navigating to settings page
                if (window.settingsManager) {
                    window.settingsManager.loadSettings();
                }
                break;
        }
    }
});