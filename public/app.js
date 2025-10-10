document.addEventListener('DOMContentLoaded', () => {
    const addHeaderBtn = document.getElementById('add-header');
    const headersContainer = document.getElementById('headers-container');
    const sendBtn = document.getElementById('send');
    const saveBtn = document.getElementById('confirm-save');
    const importBtn = document.getElementById('confirm-import');
    const collectionsContainer = document.getElementById('collections-list');
    const saveRequestModal = new bootstrap.Modal(document.getElementById('saveRequestModal'));
    const importModal = new bootstrap.Modal(document.getElementById('importModal'));
    const darkModeToggle = document.getElementById('darkModeToggle');
    const createFolderBtn = document.getElementById('create-folder');
    const requestFolderSelect = document.getElementById('request-folder');
    const exportBtn = document.getElementById('export-collections');
    const importFileBtn = document.getElementById('import-file');
    const fileInput = document.getElementById('fileInput');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarResizer = document.getElementById('sidebarResizer');
    const panelResizer = document.getElementById('panelResizer');
    const requestPanel = document.querySelector('.request-panel');
    const urlBarEl = document.querySelector('.url-bar');
    
    // Initialize dark mode from localStorage
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        darkModeToggle.checked = true;
    }
    
    // Dark mode toggle handler
    darkModeToggle.addEventListener('change', () => {
        if (darkModeToggle.checked) {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.setAttribute('data-bs-theme', 'light');
            localStorage.setItem('darkMode', 'false');
        }
        
        // Re-highlight all code blocks when theme changes
        if (window.Prism) {
            document.querySelectorAll('code[class*="language-"]').forEach(block => {
                Prism.highlightElement(block);
            });
        }
    });

    // Folder management functions
    loadCollections();

    let folders = [];
    let collections = [];
    function loadCollections() {
        fetch('/api/collections')
            .then(response => response.json())
            .then(data => {
                folders = data.folders || [];
                collections = data.collections || [];
                renderTree();
                updateFolderSelect();
            });
    }

    function renderTree() {
        collectionsContainer.innerHTML = '';
        const tree = buildTree();
        tree.forEach(item => {
            collectionsContainer.appendChild(item.element);
        });
    }

    function buildTree() {
        const tree = [];
        
        // Add root folders first
        const rootFolders = folders.filter(f => !f.parentId);
        rootFolders.forEach(folder => {
            const folderElement = createFolderItem(folder);
            tree.push({ type: 'folder', id: folder.id, element: folderElement });
        });
        
        // Add root requests (no folder)
        const rootRequests = collections.filter(r => !r.folderId);
        rootRequests.forEach(request => {
            const requestElement = createCollectionItem(request);
            tree.push({ type: 'request', id: request.id, element: requestElement });
        });
        
        return tree;
    }

    function createFolderItem(folder) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.draggable = true;
        item.dataset.type = 'folder';
        item.dataset.id = folder.id;
        
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-item';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'folder-content';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = `folder-toggle ${folder.expanded ? 'expanded' : ''}`;
        toggleBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFolder(folder.id);
        };
        
        const folderIcon = document.createElement('i');
        folderIcon.className = 'bi bi-folder me-2';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'folder-name';
        nameSpan.textContent = folder.name;
        nameSpan.title = 'Double-click to edit';
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            makeEditableFolder(nameSpan, folder);
        });
        
        contentDiv.appendChild(toggleBtn);
        contentDiv.appendChild(folderIcon);
        contentDiv.appendChild(nameSpan);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'folder-actions';
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-sm btn-outline-secondary';
        addBtn.innerHTML = '<i class="bi bi-folder-plus"></i>';
        addBtn.title = 'Add subfolder';
        addBtn.onclick = (e) => {
            e.stopPropagation();
            createFolder(folder.id);
        };
        
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-outline-secondary';
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.title = 'Rename folder';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            makeEditableFolder(nameSpan, folder);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.title = 'Delete folder';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFolder(folder.id);
        };
        
        actionsDiv.appendChild(addBtn);
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        
        folderDiv.appendChild(contentDiv);
        folderDiv.appendChild(actionsDiv);
        item.appendChild(folderDiv);
        
        // Add children container
        const childrenDiv = document.createElement('div');
        childrenDiv.className = `folder-children ${folder.expanded ? '' : 'collapsed'}`;
        
        // Add child folders
        const childFolders = folders.filter(f => f.parentId === folder.id);
        childFolders.forEach(childFolder => {
            childrenDiv.appendChild(createFolderItem(childFolder));
        });
        
        // Add requests in this folder
        const folderRequests = collections.filter(r => r.folderId === folder.id);
        folderRequests.forEach(request => {
            const requestElement = createCollectionItem(request, true);
            childrenDiv.appendChild(requestElement);
        });
        
        item.appendChild(childrenDiv);
        
        // Add drag and drop handlers
        setupDragAndDrop(item);
        
        return item;
    }

    function createCollectionItem(request, inFolder = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tree-item';
        wrapper.draggable = true;
        wrapper.dataset.type = 'request';
        wrapper.dataset.id = request.id;
        
        const item = document.createElement('div');
        item.className = `collection-item ${inFolder ? 'in-folder' : ''}`;
        
        const methodBadge = document.createElement('span');
        methodBadge.className = `badge method-badge bg-${request.method}`;
        methodBadge.textContent = request.method;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'collection-name';
        nameSpan.textContent = request.name;
        nameSpan.title = 'Double-click to edit';

        // Add double-click to edit functionality
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            makeEditable(nameSpan, request);
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-outline-secondary';
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.title = 'Edit name';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            makeEditable(nameSpan, request);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.title = 'Delete request';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteRequest(request.id);
        };

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'd-flex align-items-center';
        contentDiv.appendChild(methodBadge);
        contentDiv.appendChild(nameSpan);

        item.appendChild(contentDiv);
        item.appendChild(actionsDiv);

        item.onclick = () => loadRequest(request);
        
        wrapper.appendChild(item);
        
        // Add drag and drop handlers
        setupDragAndDrop(wrapper);
        
        return wrapper;
    }

    function makeEditable(nameSpan, request) {
        const currentName = nameSpan.textContent;
        nameSpan.className = 'collection-name editing';
        nameSpan.contentEditable = true;
        nameSpan.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        function saveEdit() {
            const newName = nameSpan.textContent.trim();
            if (newName && newName !== currentName) {
                fetch(`/api/collections/${request.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName })
                }).then(() => {
                    loadCollections();
                });
            } else {
                nameSpan.textContent = currentName;
            }
            finishEdit();
        }

        function finishEdit() {
            nameSpan.contentEditable = false;
            nameSpan.className = 'collection-name';
            nameSpan.blur();
        }

        function handleKeys(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                nameSpan.textContent = currentName;
                finishEdit();
            }
        }

        nameSpan.addEventListener('keydown', handleKeys, { once: true });
        nameSpan.addEventListener('blur', saveEdit, { once: true });
    }

    // This function is no longer needed as we're using the method name directly as a class
    // Keeping it for backward compatibility
    function getMethodColor(method) {
        return method; // Just return the method name directly
    }

    // ------------------------------
    // Layout: toggle + resizers
    // ------------------------------
    initLayoutFromStorage();
    setupSidebarToggle();
    setupSidebarResizer();
    setupPanelResizer();

    function initLayoutFromStorage() {
        // Sidebar collapse state
        const collapsed = localStorage.getItem('sidebarCollapsed');
        if (collapsed === 'true') {
            sidebar.classList.add('collapsed');
        }

        // Sidebar width
        const savedSidebarWidth = localStorage.getItem('sidebarWidth');
        if (savedSidebarWidth) {
            document.documentElement.style.setProperty('--sidebar-width', savedSidebarWidth);
        }

        // Request tabs height
        const savedRequestHeight = localStorage.getItem('requestSectionHeight');
        if (savedRequestHeight) {
            document.documentElement.style.setProperty('--request-section-height', savedRequestHeight);
        }
    }

    function setupSidebarToggle() {
        if (!sidebarToggle) return;
        sidebarToggle.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', String(isCollapsed));
        });
    }

    function setupSidebarResizer() {
        if (!sidebarResizer) return;
        let isDragging = false;

        sidebarResizer.addEventListener('mousedown', (e) => {
            if (sidebar.classList.contains('collapsed')) return;
            isDragging = true;
            document.body.classList.add('resizing');
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const main = document.querySelector('.main-content');
            const rect = main.getBoundingClientRect();
            let newWidth = e.clientX - rect.left; // width inside main-content
            const min = 160; // px
            const max = Math.min(520, rect.width * 0.6);
            newWidth = Math.max(min, Math.min(max, newWidth));
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
            localStorage.setItem('sidebarWidth', `${newWidth}px`);
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.classList.remove('resizing');
        });
    }

    function setupPanelResizer() {
        if (!panelResizer || !requestPanel || !urlBarEl) return;
        let isDragging = false;

        panelResizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            document.body.classList.add('resizing');
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const panelRect = requestPanel.getBoundingClientRect();
            const styles = getComputedStyle(requestPanel);
            const paddingTop = parseFloat(styles.paddingTop) || 0;
            const paddingBottom = parseFloat(styles.paddingBottom) || 0;
            const gap = parseFloat(styles.rowGap || styles.gap) || 16;

            // Space accounting inside request panel
            const innerHeight = panelRect.height - paddingTop - paddingBottom;
            const urlBarHeight = urlBarEl.offsetHeight;
            const resizerThickness = 6;
            const availableForSplit = innerHeight - urlBarHeight - gap - resizerThickness;

            // Mouse Y relative to top inner content
            const y = e.clientY - panelRect.top - paddingTop;
            let requestTabsHeight = y - urlBarHeight - gap;

            // Constraints
            const minH = 120; // px
            const maxH = Math.max(minH, availableForSplit * 0.8);
            requestTabsHeight = Math.max(minH, Math.min(maxH, requestTabsHeight));

            const percent = (requestTabsHeight / availableForSplit) * 100;
            const clampedPercent = Math.max(15, Math.min(70, percent));
            const value = `${clampedPercent}%`;
            document.documentElement.style.setProperty('--request-section-height', value);
            localStorage.setItem('requestSectionHeight', value);
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.classList.remove('resizing');
        });
    }

    function loadRequest(request) {
        document.getElementById('method').value = request.method;
        document.getElementById('url').value = request.url;
        document.getElementById('request-body').value = request.body || '';

        // Clear existing headers
        const headerRows = document.querySelectorAll('.header-row');
        headerRows.forEach((row, index) => {
            if (index > 0) row.remove();
        });

        // Add saved headers
        const firstHeaderRow = document.querySelector('.header-row');
        if (request.headers && Object.keys(request.headers).length > 0) {
            const entries = Object.entries(request.headers);
            if (entries.length > 0) {
                const [firstKey, firstValue] = entries[0];
                firstHeaderRow.querySelector('.header-key input').value = firstKey;
                firstHeaderRow.querySelector('.header-value input').value = firstValue;

                // Add remaining headers
                entries.slice(1).forEach(([key, value]) => {
                    addHeader(key, value);
                });
            }
        } else {
            // Clear first header row
            firstHeaderRow.querySelector('.header-key input').value = '';
            firstHeaderRow.querySelector('.header-value input').value = '';
        }
    }

    function deleteRequest(id) {
        if (confirm('Are you sure you want to delete this request?')) {
            fetch(`/api/collections/${id}`, {
                method: 'DELETE'
            }).then(() => {
                loadCollections();
            });
        }
    }

    addHeaderBtn.addEventListener('click', () => {
        addHeader();
    });

    function addHeader(key = '', value = '') {
        const headerRow = document.createElement('div');
        headerRow.className = 'header-row';
        headerRow.innerHTML = `
            <div class="header-key">
                <input type="text" class="form-control" placeholder="Header name" value="${key}">
            </div>
            <div class="header-value">
                <input type="text" class="form-control" placeholder="Value" value="${value}">
            </div>
            <div class="header-actions">
                <button class="btn btn-sm btn-outline-danger remove-header">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        headersContainer.appendChild(headerRow);
    }

    headersContainer.addEventListener('click', (e) => {
        // Vérifier si l'élément cliqué est le bouton ou l'icône à l'intérieur du bouton
        if (e.target.classList.contains('remove-header') || 
            e.target.closest('.remove-header')) {
            // Trouver et supprimer la ligne de header parente
            const headerRow = e.target.closest('.header-row');
            if (headerRow) {
                headerRow.remove();
            }
        }
    });

    saveBtn.addEventListener('click', () => {
        const name = document.getElementById('request-name').value;
        if (!name) {
            alert('Please enter a name for the request');
            return;
        }

        const method = document.getElementById('method').value;
        const url = document.getElementById('url').value;
        const requestBody = document.getElementById('request-body').value;
        const folderId = document.getElementById('request-folder').value || null;
        
        // Collect headers
        const headers = {};
        document.querySelectorAll('.header-row').forEach(row => {
            const key = row.querySelector('.header-key input').value.trim();
            const value = row.querySelector('.header-value input').value.trim();
            if (key) {
                headers[key] = value;
            }
        });

        fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                method,
                url,
                headers,
                body: requestBody,
                folderId
            })
        }).then(() => {
            loadCollections();
            saveRequestModal.hide();
            document.getElementById('request-name').value = '';
            document.getElementById('request-folder').value = '';
        });
    });
    
    // Import collections from API
    importBtn.addEventListener('click', async () => {
        const importUrl = document.getElementById('import-url').value.trim();
        if (!importUrl) {
            showImportStatus('error', 'Please enter a valid URL');
            return;
        }
        
        // Show loading spinner
        const spinner = document.getElementById('import-spinner');
        spinner.classList.remove('d-none');
        importBtn.disabled = true;
        
        try {
            const response = await fetch('/api/collections/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: importUrl })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showImportStatus('success', result.message);
                loadCollections();
                // Auto-close modal after 2 seconds on success
                setTimeout(() => {
                    importModal.hide();
                    resetImportForm();
                }, 2000);
            } else {
                showImportStatus('error', result.error || 'Failed to import collections');
            }
        } catch (error) {
            showImportStatus('error', 'Network error: ' + error.message);
        } finally {
            // Hide spinner
            spinner.classList.add('d-none');
            importBtn.disabled = false;
        }
    });
    
    function showImportStatus(type, message) {
        const statusEl = document.getElementById('import-status');
        statusEl.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
        statusEl.textContent = message;
        statusEl.classList.remove('d-none');
    }
    
    function resetImportForm() {
        document.getElementById('import-url').value = '';
        document.getElementById('import-status').classList.add('d-none');
        document.getElementById('import-spinner').classList.add('d-none');
        importBtn.disabled = false;
    }
    
    // Reset import form when modal is closed
    document.getElementById('importModal').addEventListener('hidden.bs.modal', resetImportForm);

    sendBtn.addEventListener('click', async () => {
        const method = document.getElementById('method').value;
        const url = document.getElementById('url').value;
        const requestBody = document.getElementById('request-body').value;
        
        // Collect headers
        const headers = {};
        document.querySelectorAll('.header-row').forEach(row => {
            const key = row.querySelector('.header-key input').value.trim();
            const value = row.querySelector('.header-value input').value.trim();
            if (key) {
                headers[key] = value;
            }
        });

        try {
            const startTime = Date.now();
            
            const response = await fetch('/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method,
                    url,
                    headers,
                    data: requestBody ? JSON.parse(requestBody) : undefined
                })
            });

            const endTime = Date.now();
            const responseData = await response.json();

            // Update status code
            const statusBadge = document.getElementById('status-code');
            statusBadge.textContent = `Status: ${responseData.status}`;
            statusBadge.className = `status-badge ${responseData.status >= 200 && responseData.status < 300 ? 'success' : 'error'}`;

            // Update response time
            document.getElementById('response-time').textContent = `Time: ${endTime - startTime}ms`;

            // Update response body with syntax highlighting
            const responseBodyElement = document.getElementById('response-data');
            const responseHeadersElement = document.getElementById('response-headers-data');
            
            // Detect content type and format response
            const contentType = responseData.headers['content-type'] || '';
            const responseBody = formatAndHighlightResponse(responseData.data, contentType);
            
            responseBodyElement.innerHTML = responseBody.content;
            responseBodyElement.className = responseBody.language;
            
            // Format headers as JSON
            const headersFormatted = JSON.stringify(responseData.headers, null, 2);
            responseHeadersElement.textContent = headersFormatted;
            responseHeadersElement.className = 'language-json';
            
            // Apply syntax highlighting
            if (window.Prism) {
                Prism.highlightElement(responseBodyElement);
                Prism.highlightElement(responseHeadersElement);
            }

        } catch (error) {
            const responseBodyElement = document.getElementById('response-data');
            const errorContent = JSON.stringify({ error: error.message }, null, 2);
            
            responseBodyElement.textContent = errorContent;
            responseBodyElement.className = 'language-json';
            
            if (window.Prism) {
                Prism.highlightElement(responseBodyElement);
            }
            
            document.getElementById('status-code').textContent = 'Status: Error';
            document.getElementById('status-code').className = 'status-badge error';
        }
    });

    // Response formatting and syntax highlighting
    function formatAndHighlightResponse(data, contentType) {
        const lowerContentType = contentType.toLowerCase();
        
        // Detect JSON
        if (lowerContentType.includes('application/json') || lowerContentType.includes('text/json')) {
            try {
                const formatted = typeof data === 'string' ? JSON.parse(data) : data;
                return {
                    content: JSON.stringify(formatted, null, 2),
                    language: 'language-json'
                };
            } catch (e) {
                return {
                    content: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                    language: 'language-json'
                };
            }
        }
        
        // Detect XML/HTML
        if (lowerContentType.includes('application/xml') || 
            lowerContentType.includes('text/xml') ||
            lowerContentType.includes('application/xhtml') ||
            lowerContentType.includes('text/html')) {
            const content = typeof data === 'string' ? data : String(data);
            return {
                content: formatXML(content),
                language: lowerContentType.includes('html') ? 'language-html' : 'language-xml'
            };
        }
        
        // Detect JavaScript
        if (lowerContentType.includes('application/javascript') || 
            lowerContentType.includes('text/javascript')) {
            return {
                content: typeof data === 'string' ? data : String(data),
                language: 'language-javascript'
            };
        }
        
        // Detect CSS
        if (lowerContentType.includes('text/css')) {
            return {
                content: typeof data === 'string' ? data : String(data),
                language: 'language-css'
            };
        }
        
        // Try to auto-detect JSON if no content-type
        if (!contentType || contentType === '') {
            try {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                return {
                    content: JSON.stringify(parsed, null, 2),
                    language: 'language-json'
                };
            } catch (e) {
                // Fall through to plain text
            }
        }
        
        // Default to plain text
        return {
            content: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
            language: 'language-none'
        };
    }
    
    function formatXML(xml) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, 'application/xml');
            const serializer = new XMLSerializer();
            let formatted = serializer.serializeToString(xmlDoc);
            
            // Simple XML formatting with proper indentation
            let indent = 0;
            formatted = formatted.replace(/></g, '>\\n<');
            const lines = formatted.split('\\n');
            
            return lines.map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('</')) {
                    indent = Math.max(0, indent - 1);
                }
                const result = '  '.repeat(indent) + trimmed;
                if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
                    indent++;
                }
                return result;
            }).join('\\n');
        } catch (e) {
            return xml;
        }
    }

    // Folder management functions
    function makeEditableFolder(nameSpan, folder) {
        const currentName = nameSpan.textContent;
        nameSpan.className = 'folder-name editing';
        nameSpan.contentEditable = true;
        nameSpan.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        function saveEdit() {
            const newName = nameSpan.textContent.trim();
            if (newName && newName !== currentName) {
                fetch(`/api/folders/${folder.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName })
                }).then(() => {
                    loadCollections();
                });
            } else {
                nameSpan.textContent = currentName;
            }
            finishEdit();
        }

        function finishEdit() {
            nameSpan.contentEditable = false;
            nameSpan.className = 'folder-name';
            nameSpan.blur();
        }

        function handleKeys(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                nameSpan.textContent = currentName;
                finishEdit();
            }
        }

        nameSpan.addEventListener('keydown', handleKeys, { once: true });
        nameSpan.addEventListener('blur', saveEdit, { once: true });
    }

    function toggleFolder(folderId) {
        fetch(`/api/folders/${folderId}/toggle`, {
            method: 'PUT'
        }).then(() => {
            loadCollections();
        });
    }

    function createFolder(parentId = null) {
        const name = prompt('Enter folder name:');
        if (!name) return;

        fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, parentId })
        }).then(() => {
            loadCollections();
        });
    }

    function deleteFolder(folderId) {
        if (confirm('Are you sure you want to delete this folder? Its contents will be moved to the parent folder.')) {
            fetch(`/api/folders/${folderId}`, {
                method: 'DELETE'
            }).then(() => {
                loadCollections();
            });
        }
    }

    function updateFolderSelect() {
        const select = requestFolderSelect;
        if (!select) return;
        
        select.innerHTML = '<option value="">No folder (root)</option>';
        
        function addFolderOptions(folderList, prefix = '') {
            folderList.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = prefix + folder.name;
                select.appendChild(option);
                
                // Add child folders
                const children = folders.filter(f => f.parentId === folder.id);
                if (children.length > 0) {
                    addFolderOptions(children, prefix + '  ');
                }
            });
        }
        
        const rootFolders = folders.filter(f => !f.parentId);
        addFolderOptions(rootFolders);
    }

    function setupDragAndDrop(element) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: element.dataset.type,
                id: element.dataset.id
            }));
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (element.dataset.type === 'folder') {
                element.classList.add('drag-over');
            }
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            
            if (element.dataset.type !== 'folder') return;
            
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetFolderId = element.dataset.id;
            
            if (dragData.type === 'request') {
                // Move request to folder
                fetch(`/api/collections/${dragData.id}/move`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ folderId: targetFolderId })
                }).then(() => {
                    loadCollections();
                });
            }
        });
    }

    // Create folder button handler
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', () => {
            createFolder();
        });
    }

    // Export collections handler
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportCollections();
        });
    }

    // Import file button handler
    if (importFileBtn) {
        importFileBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // File input change handler
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importFromFile(file);
            }
        });
    }

    // Add drag over to collections container for root drop
    collectionsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    collectionsContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // Only handle drops on the container itself, not on child elements
        if (e.target !== collectionsContainer) return;
        
        const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
        
        if (dragData.type === 'request') {
            // Move request to root (no folder)
            fetch(`/api/collections/${dragData.id}/move`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ folderId: null })
            }).then(() => {
                loadCollections();
            });
        }
    });

    // Export/Import functions
    function exportCollections() {
        fetch('/api/export')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Export failed');
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `api-tester-collections-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            })
            .catch(error => {
                alert('Export failed: ' + error.message);
            });
    }

    function importFromFile(file) {
        if (!file.type.includes('json')) {
            alert('Please select a valid JSON file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Show confirmation dialog
                const confirmMessage = `This will import ${(data.collections || []).length} collections and ${(data.folders || []).length} folders.\n\nChoose import mode:`;
                const mergeMode = confirm(confirmMessage + '\n\nClick OK to REPLACE existing data, or Cancel to MERGE with existing data.');
                
                fetch('/api/import-file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        data,
                        mergeMode: mergeMode ? 'replace' : 'merge'
                    })
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        alert(result.message);
                        loadCollections();
                    } else {
                        alert('Import failed: ' + result.error);
                    }
                })
                .catch(error => {
                    alert('Import failed: ' + error.message);
                });
                
            } catch (error) {
                alert('Invalid JSON file: ' + error.message);
            }
        };
        
        reader.readAsText(file);
        
        // Reset file input
        fileInput.value = '';
    }
});
