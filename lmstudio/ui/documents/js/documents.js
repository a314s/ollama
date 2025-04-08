/**
 * Documents Management Interface
 * 
 * Handles document listing, viewing, searching, and upload functionality
 */

// Main DOM elements
const documentList = document.getElementById('document-list');
const documentDetail = document.getElementById('document-detail');
const documentsContainer = document.getElementById('documents-container');
const noDocumentsAlert = document.getElementById('no-documents');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const uploadButton = document.getElementById('upload-button');
const backButton = document.getElementById('back-button');
const uploadModal = new bootstrap.Modal(document.getElementById('upload-modal'));
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const uploadSubmit = document.getElementById('upload-submit');
const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const loadingOverlay = document.getElementById('loading-overlay');

// Detail view elements
const detailTitle = document.getElementById('detail-title');
const metadataContainer = document.getElementById('metadata-container');
const tocContainer = document.getElementById('toc-container');
const entitiesContainer = document.getElementById('entities-container');
const contentContainer = document.getElementById('content-container');

// API endpoints
const API = {
    LIST: '/api/documents',
    GET: '/api/documents/',
    UPLOAD: '/api/documents',
    SEARCH: '/api/documents/search',
    SECTIONS: '/api/documents/{id}/sections',
    TOC: '/api/documents/{id}/toc',
    ENTITIES: '/api/documents/{id}/entities',
    OPEN: '/api/documents/{id}/open'
};

// Current document state
let currentDocuments = [];
let currentDocument = null;
let currentSection = null;
let currentSearchResults = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Load the document list
    loadDocuments();
    
    // Set up event listeners
    setupEventListeners();
});

/**
 * Set up all event listeners for the UI
 */
function setupEventListeners() {
    // Search functionality
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Upload functionality
    uploadButton.addEventListener('click', () => {
        uploadModal.show();
    });
    
    uploadSubmit.addEventListener('click', handleUpload);
    
    // Back button
    backButton.addEventListener('click', () => {
        showDocumentList();
    });
}

/**
 * Load all documents from the API
 */
async function loadDocuments() {
    showLoading(true);
    
    try {
        const response = await fetch(API.LIST);
        if (!response.ok) {
            throw new Error(`Error loading documents: ${response.statusText}`);
        }
        
        const documents = await response.json();
        currentDocuments = documents;
        
        renderDocumentList(documents);
    } catch (error) {
        showError('Failed to load documents', error);
    } finally {
        showLoading(false);
    }
}

/**
 * Render the document list in the UI
 */
function renderDocumentList(documents) {
    // Clear the container
    documentsContainer.innerHTML = '';
    
    if (documents.length === 0) {
        noDocumentsAlert.style.display = 'block';
        return;
    }
    
    noDocumentsAlert.style.display = 'none';
    
    // Create a card for each document
    documents.forEach(doc => {
        const card = createDocumentCard(doc);
        documentsContainer.appendChild(card);
    });
}

/**
 * Create a card element for a document
 */
function createDocumentCard(doc) {
    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4';
    
    const card = document.createElement('div');
    card.className = 'card document-card h-100';
    card.addEventListener('click', () => {
        loadDocumentDetails(doc.id);
    });
    
    // Determine icon based on file type
    let icon = 'file-earmark-text';
    if (doc.metadata.filetype) {
        const type = doc.metadata.filetype.toLowerCase();
        if (type.includes('pdf')) {
            icon = 'file-earmark-pdf';
        } else if (type.includes('word') || type.includes('docx')) {
            icon = 'file-earmark-word';
        } else if (type.includes('excel') || type.includes('xlsx')) {
            icon = 'file-earmark-excel';
        } else if (type.includes('powerpoint') || type.includes('pptx')) {
            icon = 'file-earmark-ppt';
        } else if (type.includes('text') || type.includes('txt')) {
            icon = 'file-earmark-text';
        } else if (type.includes('markdown') || type.includes('md')) {
            icon = 'markdown';
        }
    }
    
    // Card actions
    const actions = document.createElement('div');
    actions.className = 'document-actions';
    
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-sm btn-outline-secondary me-1';
    openBtn.innerHTML = '<i class="bi bi-box-arrow-up-right"></i>';
    openBtn.title = 'Open Original';
    openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDocument(doc.id);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-outline-danger';
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.title = 'Delete Document';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${doc.metadata.filename}"?`)) {
            deleteDocument(doc.id);
        }
    });
    
    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);
    
    // Format file size
    const filesize = doc.metadata.filesize ? formatFileSize(doc.metadata.filesize) : 'Unknown';
    
    // Create upload/modified date
    const uploadDate = doc.metadata.uploadDate ? new Date(doc.metadata.uploadDate).toLocaleDateString() : 'Unknown';
    
    card.innerHTML = `
        <div class="card-body">
            <h5 class="card-title">
                <i class="bi bi-${icon} me-2"></i>
                ${doc.metadata.filename || 'Unnamed Document'}
            </h5>
            <p class="card-text text-truncate">${doc.metadata.summary || 'No summary available'}</p>
        </div>
        <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between">
                <span>Size:</span>
                <span>${filesize}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
                <span>Words:</span>
                <span>${doc.metadata.wordCount || 'Unknown'}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
                <span>Uploaded:</span>
                <span>${uploadDate}</span>
            </li>
        </ul>
    `;
    
    card.appendChild(actions);
    col.appendChild(card);
    
    return col;
}

/**
 * Load document details from the API
 */
async function loadDocumentDetails(docId) {
    showLoading(true);
    
    try {
        const response = await fetch(API.GET + docId);
        if (!response.ok) {
            throw new Error(`Error loading document: ${response.statusText}`);
        }
        
        const document = await response.json();
        currentDocument = document;
        
        // Load document sections
        const sectionsResponse = await fetch(API.SECTIONS.replace('{id}', docId));
        const sectionsData = await sectionsResponse.json();
        
        // Load table of contents
        const tocResponse = await fetch(API.TOC.replace('{id}', docId));
        const tocData = await tocResponse.json();
        
        // Load entities
        const entitiesResponse = await fetch(API.ENTITIES.replace('{id}', docId));
        const entitiesData = await entitiesResponse.json();
        
        // Render everything
        renderDocumentDetails(document, sectionsData, tocData, entitiesData);
        
        // Show the detail view
        showDocumentDetail();
    } catch (error) {
        showError('Failed to load document details', error);
    } finally {
        showLoading(false);
    }
}

/**
 * Render document details in the UI
 */
function renderDocumentDetails(document, sections, toc, entities) {
    // Set the title
    detailTitle.textContent = document.metadata.filename || 'Document Details';
    
    // Render metadata
    renderMetadata(document.metadata);
    
    // Render table of contents
    renderTableOfContents(toc);
    
    // Render entities
    renderEntities(entities);
    
    // Render content (first section by default)
    if (sections && sections.length > 0) {
        currentSection = sections[0];
        renderContent(sections[0]);
    } else {
        contentContainer.innerHTML = '<div class="alert alert-info">No content available</div>';
    }
}

/**
 * Render document metadata
 */
function renderMetadata(metadata) {
    metadataContainer.innerHTML = '';
    
    // Skip certain metadata fields that are displayed elsewhere
    const skipFields = ['filename', 'summary'];
    
    // Display metadata fields
    Object.entries(metadata).forEach(([key, value]) => {
        if (skipFields.includes(key)) {
            return;
        }
        
        // Format the key for display
        const displayKey = key.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
        
        // Format the value based on its type
        let displayValue = value;
        if (key.toLowerCase().includes('date') && value) {
            displayValue = new Date(value).toLocaleString();
        } else if (key.toLowerCase().includes('size') && !isNaN(value)) {
            displayValue = formatFileSize(value);
        }
        
        const item = document.createElement('div');
        item.className = 'metadata-item';
        item.innerHTML = `
            <span>${displayKey}:</span>
            <span>${displayValue || 'N/A'}</span>
        `;
        
        metadataContainer.appendChild(item);
    });
}

/**
 * Render table of contents
 */
function renderTableOfContents(toc) {
    tocContainer.innerHTML = '';
    
    if (!toc || toc.length === 0) {
        tocContainer.innerHTML = '<div class="alert alert-info">No table of contents available</div>';
        return;
    }
    
    const list = document.createElement('ul');
    list.className = 'list-group';
    
    toc.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.style.paddingLeft = `${(item.level * 10) + 15}px`;
        li.textContent = item.title;
        li.style.cursor = 'pointer';
        
        li.addEventListener('click', () => {
            // Navigate to the section
            if (item.sectionIndex !== undefined) {
                navigateToSection(item.sectionIndex);
            }
        });
        
        list.appendChild(li);
    });
    
    tocContainer.appendChild(list);
}

/**
 * Render entity list
 */
function renderEntities(entities) {
    entitiesContainer.innerHTML = '';
    
    if (!entities || Object.keys(entities).length === 0) {
        entitiesContainer.innerHTML = '<div class="alert alert-info">No entities detected</div>';
        return;
    }
    
    // Group entities by type
    Object.entries(entities).forEach(([type, items]) => {
        if (!items || items.length === 0) {
            return;
        }
        
        const typeHeading = document.createElement('h6');
        typeHeading.className = 'mb-2 mt-3';
        typeHeading.textContent = type.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
        
        entitiesContainer.appendChild(typeHeading);
        
        const badges = document.createElement('div');
        badges.className = 'd-flex flex-wrap gap-2 mb-3';
        
        items.forEach(entity => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-light text-dark';
            badge.textContent = entity.text;
            badge.style.cursor = 'pointer';
            
            badge.addEventListener('click', () => {
                // Search for this entity in the document
                searchInDocument(entity.text);
            });
            
            badges.appendChild(badge);
        });
        
        entitiesContainer.appendChild(badges);
    });
}

/**
 * Render document content
 */
function renderContent(section) {
    contentContainer.innerHTML = '';
    
    if (!section || !section.content) {
        contentContainer.innerHTML = '<div class="alert alert-info">No content available</div>';
        return;
    }
    
    // Create heading
    if (section.heading) {
        const heading = document.createElement('h3');
        heading.className = 'mb-4';
        heading.textContent = section.heading;
        contentContainer.appendChild(heading);
    }
    
    // Create content
    const content = document.createElement('div');
    content.className = 'content';
    content.innerHTML = formatContent(section.content);
    contentContainer.appendChild(content);
}

/**
 * Format content for display, adding basic markdown-like formatting
 */
function formatContent(text) {
    if (!text) return '';
    
    // Convert newlines to HTML breaks
    let formatted = text.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * Navigate to a specific section
 */
function navigateToSection(sectionIndex) {
    if (!currentDocument) return;
    
    showLoading(true);
    
    fetch(API.SECTIONS.replace('{id}', currentDocument.id))
        .then(response => response.json())
        .then(sections => {
            if (sections && sections[sectionIndex]) {
                currentSection = sections[sectionIndex];
                renderContent(sections[sectionIndex]);
            }
        })
        .catch(error => {
            showError('Failed to navigate to section', error);
        })
        .finally(() => {
            showLoading(false);
        });
}

/**
 * Search within the current document
 */
function searchInDocument(query) {
    if (!currentDocument) return;
    
    // Highlight occurrences in the current section
    if (currentSection && currentSection.content) {
        const content = contentContainer.querySelector('.content');
        if (content) {
            // Replace the content with highlighted version
            const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
            const highlighted = currentSection.content.replace(
                regex, 
                '<span class="bg-warning">$1</span>'
            );
            content.innerHTML = formatContent(highlighted);
        }
    }
}

/**
 * Handle the search button click
 */
function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        // If empty, just reload all documents
        loadDocuments();
        return;
    }
    
    showLoading(true);
    
    fetch(`${API.SEARCH}?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(results => {
            // Store results for potential filtering/sorting
            currentSearchResults = results;
            renderSearchResults(results, query);
        })
        .catch(error => {
            showError('Search failed', error);
        })
        .finally(() => {
            showLoading(false);
        });
}

/**
 * Render search results with enhanced UI
 */
function renderSearchResults(results, query) {
    // Create search results view
    documentsContainer.innerHTML = '';
    
    if (results.length === 0) {
        // Show no results message
        const noResults = document.createElement('div');
        noResults.className = 'alert alert-info w-100';
        noResults.textContent = `No results found for "${query}". Try a different search term.`;
        documentsContainer.appendChild(noResults);
        return;
    }
    
    // Group results by document
    const documentGroups = {};
    results.forEach(result => {
        if (!documentGroups[result.DocumentID]) {
            documentGroups[result.DocumentID] = [];
        }
        documentGroups[result.DocumentID].push(result);
    });
    
    // Create search results header
    const header = document.createElement('div');
    header.className = 'search-results-header mb-4';
    header.innerHTML = `
        <h4>Search Results for "${query}"</h4>
        <p>Found ${results.length} matches across ${Object.keys(documentGroups).length} documents</p>
        <div class="d-flex justify-content-between align-items-center">
            <div class="search-filters">
                <button class="btn btn-sm btn-outline-primary me-2" id="sort-relevance">Sort by Relevance</button>
                <button class="btn btn-sm btn-outline-secondary me-2" id="sort-recent">Sort by Recent</button>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">Filter By</button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item filter-option" data-filter="all" href="#">All Results</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item filter-option" data-filter="keyword" href="#">Keyword Matches</a></li>
                        <li><a class="dropdown-item filter-option" data-filter="semantic" href="#">Semantic Matches</a></li>
                    </ul>
                </div>
            </div>
            <button class="btn btn-sm btn-primary" id="clear-search">Clear Search</button>
        </div>
    `;
    documentsContainer.appendChild(header);
    
    // Add search result items
    Object.keys(documentGroups).forEach(docId => {
        const docResults = documentGroups[docId];
        // Take the first result to get document information
        const docInfo = docResults[0];
        
        // Create document card
        const docCard = document.createElement('div');
        docCard.className = 'card mb-4 search-result-card';
        
        // Document header
        const docHeader = document.createElement('div');
        docHeader.className = 'card-header d-flex justify-content-between align-items-center';
        docHeader.innerHTML = `
            <h5 class="mb-0">
                <i class="bi bi-file-text me-2"></i>
                ${escapeHtml(docInfo.DocumentName)}
            </h5>
            <div class="document-actions">
                <button class="btn btn-sm btn-outline-primary view-document" data-document-id="${docInfo.DocumentID}">
                    <i class="bi bi-eye"></i> View
                </button>
            </div>
        `;
        docCard.appendChild(docHeader);
        
        // Document metadata
        if (docInfo.Metadata) {
            const metadataDiv = document.createElement('div');
            metadataDiv.className = 'card-subtitle px-3 py-2 bg-light text-muted small';
            
            // Document topics
            let topicsHtml = '';
            if (docInfo.Metadata.TopicList && docInfo.Metadata.TopicList.length > 0) {
                topicsHtml = `<div class="mt-1">Topics: ${docInfo.Metadata.TopicList.map(t => 
                    `<span class="badge bg-secondary me-1">${t}</span>`).join('')}</div>`;
            }
            
            metadataDiv.innerHTML = `
                <div class="d-flex justify-content-between">
                    <span>${docInfo.Metadata.FileType || 'Unknown type'} · ${formatFileSize(docInfo.Metadata.FileSize)}</span>
                    <span>${docInfo.Metadata.WordCount || 0} words</span>
                    <span>Last modified: ${docInfo.Metadata.LastModified ? new Date(docInfo.Metadata.LastModified).toLocaleDateString() : 'Unknown'}</span>
                </div>
                ${topicsHtml}
            `;
            docCard.appendChild(metadataDiv);
        }
        
        // Document results
        const resultsList = document.createElement('ul');
        resultsList.className = 'list-group list-group-flush';
        
        docResults.forEach(result => {
            const resultItem = document.createElement('li');
            resultItem.className = 'list-group-item search-result-item';
            
            // Format the content with highlighted search terms
            const highlightedContent = highlightSearchTerms(result.Content, query);
            
            // Calculate a confidence level label based on similarity score
            let confidenceClass = 'bg-success';
            let confidenceText = 'High Match';
            
            if (result.Similarity < 0.6) {
                confidenceClass = 'bg-warning';
                confidenceText = 'Medium Match';
            } 
            if (result.Similarity < 0.4) {
                confidenceClass = 'bg-danger';
                confidenceText = 'Low Match';
            }
            
            // Add score breakdown if available
            let scoreBreakdown = '';
            if (result.Metadata) {
                scoreBreakdown = `
                <div class="small score-detail mt-1" style="display: none;">
                    <div class="progress mt-1" style="height: 5px;">
                        <div class="progress-bar bg-primary" style="width: ${Math.round(result.Metadata.SemanticScore * 100)}%" 
                            title="Semantic similarity: ${Math.round(result.Metadata.SemanticScore * 100)}%"></div>
                    </div>
                    <div class="d-flex justify-content-between text-muted mt-1">
                        <span>Semantic: ${Math.round(result.Metadata.SemanticScore * 100)}%</span>
                        <span>Keyword: ${Math.round(result.Metadata.KeywordScore * 100)}%</span>
                        <span>Topic: ${Math.round(result.Metadata.TopicScore * 100)}%</span>
                        <span>Title: ${Math.round(result.Metadata.TitleScore * 100)}%</span>
                    </div>
                </div>`;
            }
            
            resultItem.innerHTML = `
                <div class="d-flex align-items-start">
                    <span class="badge ${confidenceClass} me-2 mt-1">${confidenceText}</span>
                    <div class="flex-grow-1">
                        <div class="search-result-content">${highlightedContent}</div>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <div>
                                <button class="btn btn-sm btn-link p-0 toggle-score-detail">
                                    <i class="bi bi-info-circle"></i> Match details
                                </button>
                            </div>
                            <button class="btn btn-sm btn-outline-primary goto-result" 
                                data-document-id="${result.DocumentID}" 
                                data-chunk-index="${result.ChunkIndex}">
                                Go to context
                            </button>
                        </div>
                        ${scoreBreakdown}
                    </div>
                </div>
            `;
            resultsList.appendChild(resultItem);
        });
        
        docCard.appendChild(resultsList);
        documentsContainer.appendChild(docCard);
    });
    
    // Add event listeners for the search filter buttons
    document.getElementById('sort-relevance').addEventListener('click', () => {
        sortSearchResults('relevance');
    });
    
    document.getElementById('sort-recent').addEventListener('click', () => {
        sortSearchResults('recent');
    });
    
    document.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            filterSearchResults(e.target.dataset.filter);
        });
    });
    
    document.getElementById('clear-search').addEventListener('click', () => {
        searchInput.value = '';
        loadDocuments();
    });
    
    // Add event listeners for result actions
    document.querySelectorAll('.view-document').forEach(btn => {
        btn.addEventListener('click', () => {
            loadDocumentDetails(btn.dataset.documentId);
        });
    });
    
    document.querySelectorAll('.goto-result').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateToSearchResult(btn.dataset.documentId, parseInt(btn.dataset.chunkIndex));
        });
    });
    
    document.querySelectorAll('.toggle-score-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const detail = e.target.closest('.search-result-item').querySelector('.score-detail');
            if (detail) {
                detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            }
        });
    });
}

/**
 * Highlight search terms in the result content
 */
function highlightSearchTerms(content, query) {
    if (!content) return '';
    
    // Escape HTML content
    let htmlContent = escapeHtml(content);
    
    // Highlight the full query
    const escapedQuery = escapeRegExp(query.trim().toLowerCase());
    let regex = new RegExp(`(${escapedQuery})`, 'gi');
    htmlContent = htmlContent.replace(regex, '<mark class="bg-warning">$1</mark>');
    
    // Highlight individual words (only for words longer than 2 chars)
    const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    words.forEach(word => {
        const escapedWord = escapeRegExp(word);
        regex = new RegExp(`(${escapedWord})`, 'gi');
        htmlContent = htmlContent.replace(regex, '<mark class="bg-light text-dark">$1</mark>');
    });
    
    return htmlContent;
}

/**
 * Sort search results by relevance or recency
 */
function sortSearchResults(criteria) {
    if (!currentSearchResults || currentSearchResults.length === 0) return;
    
    let sortedResults = [...currentSearchResults];
    
    if (criteria === 'relevance') {
        // Already sorted by relevance from the backend
        // Just update UI
        document.getElementById('sort-relevance').classList.replace('btn-outline-primary', 'btn-primary');
        document.getElementById('sort-recent').classList.replace('btn-primary', 'btn-outline-secondary');
    } else if (criteria === 'recent') {
        // Sort by last modified date
        sortedResults.sort((a, b) => {
            if (!a.Metadata || !a.Metadata.LastModified) return 1;
            if (!b.Metadata || !b.Metadata.LastModified) return -1;
            return new Date(b.Metadata.LastModified) - new Date(a.Metadata.LastModified);
        });
        
        document.getElementById('sort-recent').classList.replace('btn-outline-secondary', 'btn-primary');
        document.getElementById('sort-relevance').classList.replace('btn-primary', 'btn-outline-primary');
    }
    
    // Re-render with the current search query
    renderSearchResults(sortedResults, searchInput.value.trim());
}

/**
 * Filter search results by type
 */
function filterSearchResults(filter) {
    if (!currentSearchResults || currentSearchResults.length === 0) return;
    
    let filteredResults = [...currentSearchResults];
    
    if (filter === 'keyword') {
        filteredResults = filteredResults.filter(result => {
            return result.Metadata && result.Metadata.KeywordScore > 0.1;
        });
    } else if (filter === 'semantic') {
        filteredResults = filteredResults.filter(result => {
            return result.Metadata && result.Metadata.SemanticScore > 0.5;
        });
    }
    
    // Update filter button text
    const filterText = filter === 'all' ? 'All Results' : 
                       filter === 'keyword' ? 'Keyword Matches' : 
                       filter === 'semantic' ? 'Semantic Matches' : 'Filter By';
    
    document.querySelector('.dropdown-toggle').textContent = filterText;
    
    // Re-render with the current search query
    renderSearchResults(filteredResults, searchInput.value.trim());
}

/**
 * Navigate to a specific search result
 */
function navigateToSearchResult(documentId, chunkIndex) {
    loadDocumentDetails(documentId, () => {
        // After document loads, navigate to the specific chunk/section
        if (currentDocument && currentDocument.Chunks && currentDocument.Chunks.length > chunkIndex) {
            const chunk = currentDocument.Chunks[chunkIndex];
            
            // Find the closest section to this chunk
            if (currentDocument.Analysis && currentDocument.Analysis.Sections) {
                const sections = currentDocument.Analysis.Sections;
                let closestSection = 0;
                
                for (let i = 0; i < sections.length; i++) {
                    if (sections[i].StartPos <= chunk.StartPos) {
                        closestSection = i;
                    } else {
                        break;
                    }
                }
                
                // Navigate to the closest section
                navigateToSection(closestSection);
                
                // Highlight the chunk content within the section
                setTimeout(() => {
                    const contentDiv = document.querySelector('.document-content');
                    if (contentDiv) {
                        const chunkText = chunk.Content.substr(0, 50); // Use first 50 chars to find
                        if (chunkText) {
                            const textToFind = escapeRegExp(chunkText);
                            const contentHtml = contentDiv.innerHTML;
                            const highlightedHtml = contentHtml.replace(
                                new RegExp(`(${textToFind})`, 'g'), 
                                '<span class="highlighted-chunk bg-warning">$1</span>'
                            );
                            contentDiv.innerHTML = highlightedHtml;
                            
                            // Scroll to highlighted chunk
                            const highlight = contentDiv.querySelector('.highlighted-chunk');
                            if (highlight) {
                                highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }
                }, 500);
            }
        }
    });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle document upload
 */
function handleUpload() {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file to upload');
        return;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    // Show progress bar
    uploadProgressContainer.style.display = 'block';
    uploadProgressBar.style.width = '0%';
    
    // Disable submit button
    uploadSubmit.disabled = true;
    
    // Upload the file
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            uploadProgressBar.style.width = percentComplete + '%';
        }
    });
    
    xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            // Success
            uploadModal.hide();
            
            // Reset the form
            fileInput.value = '';
            uploadProgressContainer.style.display = 'none';
            
            // Reload the document list
            loadDocuments();
        } else {
            // Error
            showError('Upload failed', new Error(xhr.statusText));
        }
        
        uploadSubmit.disabled = false;
    });
    
    xhr.addEventListener('error', () => {
        showError('Upload failed', new Error('Network error'));
        uploadSubmit.disabled = false;
    });
    
    xhr.open('POST', API.UPLOAD);
    xhr.send(formData);
}

/**
 * Open a document in the default application
 */
function openDocument(docId) {
    window.open(API.OPEN.replace('{id}', docId), '_blank');
}

/**
 * Delete a document
 */
function deleteDocument(docId) {
    showLoading(true);
    
    fetch(API.GET + docId, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to delete: ${response.statusText}`);
            }
            return response.json();
        })
        .then(() => {
            // Reload the document list
            loadDocuments();
        })
        .catch(error => {
            showError('Delete failed', error);
        })
        .finally(() => {
            showLoading(false);
        });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) {
        return 'Unknown';
    }
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

/**
 * Show the document list view
 */
function showDocumentList() {
    documentList.style.display = 'block';
    documentDetail.style.display = 'none';
}

/**
 * Show the document detail view
 */
function showDocumentDetail() {
    documentList.style.display = 'none';
    documentDetail.style.display = 'block';
}

/**
 * Show or hide the loading overlay
 */
function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

/**
 * Show an error message
 */
function showError(message, error) {
    console.error(message, error);
    alert(`${message}: ${error.message}`);
}

/**
 * Escape special characters in a string for use in a RegExp
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
