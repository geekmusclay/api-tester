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
    });

    // Load saved collections
    loadCollections();

    function loadCollections() {
        fetch('/api/collections')
            .then(response => response.json())
            .then(collections => {
                collectionsContainer.innerHTML = '';
                collections.forEach(request => {
                    const item = createCollectionItem(request);
                    collectionsContainer.appendChild(item);
                });
            });
    }

    function createCollectionItem(request) {
        const item = document.createElement('div');
        item.className = 'collection-item';
        
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
        
        return item;
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
                body: requestBody
            })
        }).then(() => {
            loadCollections();
            saveRequestModal.hide();
            document.getElementById('request-name').value = '';
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

            // Update response body
            document.getElementById('response-data').textContent = 
                JSON.stringify(responseData.data, null, 2);

            // Update response headers
            document.getElementById('response-headers-data').textContent = 
                JSON.stringify(responseData.headers, null, 2);

        } catch (error) {
            document.getElementById('response-data').textContent = 
                JSON.stringify({ error: error.message }, null, 2);
            document.getElementById('status-code').textContent = 'Status: Error';
            document.getElementById('status-code').className = 'status-badge error';
        }
    });
});
