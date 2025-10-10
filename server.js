const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Set default data
db.defaults({ 
    collections: [],
    folders: []
}).write();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Get all collections and folders
app.get('/api/collections', (req, res) => {
    const collections = db.get('collections').value();
    const folders = db.get('folders').value();
    res.json({ collections, folders });
});

// Save a request to collection
app.post('/api/collections', (req, res) => {
    const { name, method, url, headers, body, folderId } = req.body;
    const newRequest = {
        id: Date.now().toString(),
        name,
        method,
        url,
        headers,
        body,
        folderId: folderId || null
    };
    db.get('collections').push(newRequest).write();
    res.json(newRequest);
});

// Update a request in collection
app.put('/api/collections/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const request = db.get('collections')
                    .find({ id })
                    .assign({ name })
                    .write();
    res.json(request);
});

// Import collections from an API endpoint
app.post('/api/collections/import', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        // Fetch collections from the provided URL
        const response = await axios.get(url);
        const importedData = response.data;
        
        // Validate the imported data
        if (!Array.isArray(importedData)) {
            return res.status(400).json({ 
                error: 'Invalid data format. Expected an array of collections.' 
            });
        }
        
        // Process and save each imported collection
        const savedCollections = [];
        for (const item of importedData) {
            if (!item.name || !item.method || !item.url) {
                continue; // Skip invalid items
            }
            
            const newRequest = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                name: item.name,
                method: item.method,
                url: item.url,
                headers: item.headers || {},
                body: item.body || '',
                folderId: item.folderId || null
            };
            
            db.get('collections').push(newRequest).write();
            savedCollections.push(newRequest);
        }
        
        res.json({ 
            success: true, 
            message: `Imported ${savedCollections.length} collections successfully`,
            collections: savedCollections 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to import collections', 
            details: error.message 
        });
    }
});

// Delete a request from collection
app.delete('/api/collections/:id', (req, res) => {
    const { id } = req.params;
    db.get('collections').remove({ id }).write();
    res.json({ success: true });
});

// Folder management endpoints

// Create a new folder
app.post('/api/folders', (req, res) => {
    const { name, parentId } = req.body;
    const newFolder = {
        id: Date.now().toString(),
        name,
        parentId: parentId || null,
        expanded: true
    };
    db.get('folders').push(newFolder).write();
    res.json(newFolder);
});

// Update folder name
app.put('/api/folders/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const folder = db.get('folders')
                    .find({ id })
                    .assign({ name })
                    .write();
    res.json(folder);
});

// Delete a folder and move its contents to parent
app.delete('/api/folders/:id', (req, res) => {
    const { id } = req.params;
    const folder = db.get('folders').find({ id }).value();
    
    if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Move child folders to parent
    db.get('folders')
      .filter({ parentId: id })
      .each(child => child.parentId = folder.parentId)
      .write();
    
    // Move requests to parent folder
    db.get('collections')
      .filter({ folderId: id })
      .each(request => request.folderId = folder.parentId)
      .write();
    
    // Delete the folder
    db.get('folders').remove({ id }).write();
    res.json({ success: true });
});

// Move request to folder
app.put('/api/collections/:id/move', (req, res) => {
    const { id } = req.params;
    const { folderId } = req.body;
    const request = db.get('collections')
                    .find({ id })
                    .assign({ folderId: folderId || null })
                    .write();
    res.json(request);
});

// Toggle folder expanded state
app.put('/api/folders/:id/toggle', (req, res) => {
    const { id } = req.params;
    const folder = db.get('folders').find({ id }).value();
    if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
    }
    
    const updated = db.get('folders')
                     .find({ id })
                     .assign({ expanded: !folder.expanded })
                     .write();
    res.json(updated);
});

// Export collections and folders to JSON
app.get('/api/export', (req, res) => {
    const collections = db.get('collections').value();
    const folders = db.get('folders').value();
    
    const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        collections,
        folders
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="api-tester-collections-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
});

// Import collections and folders from JSON
app.post('/api/import-file', (req, res) => {
    try {
        const { data, mergeMode = 'replace' } = req.body;
        
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Invalid import data' });
        }
        
        const { collections = [], folders = [] } = data;
        
        // Validate data structure
        if (!Array.isArray(collections) || !Array.isArray(folders)) {
            return res.status(400).json({ error: 'Invalid data format. Expected arrays for collections and folders.' });
        }
        
        let importedCollections = 0;
        let importedFolders = 0;
        
        if (mergeMode === 'replace') {
            // Clear existing data
            db.set('collections', []).write();
            db.set('folders', []).write();
        }
        
        // Import folders first (to maintain hierarchy)
        folders.forEach(folder => {
            if (folder.name) {
                const newFolder = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: folder.name,
                    parentId: folder.parentId || null,
                    expanded: folder.expanded !== undefined ? folder.expanded : true
                };
                db.get('folders').push(newFolder).write();
                importedFolders++;
            }
        });
        
        // Import collections
        collections.forEach(collection => {
            if (collection.name && collection.method && collection.url) {
                const newCollection = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: collection.name,
                    method: collection.method,
                    url: collection.url,
                    headers: collection.headers || {},
                    body: collection.body || '',
                    folderId: collection.folderId || null
                };
                db.get('collections').push(newCollection).write();
                importedCollections++;
            }
        });
        
        res.json({
            success: true,
            message: `Imported ${importedCollections} collections and ${importedFolders} folders successfully`,
            imported: {
                collections: importedCollections,
                folders: importedFolders
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to import data',
            details: error.message
        });
    }
});

app.post('/proxy', async (req, res) => {
    try {
        const { url, method, headers, data } = req.body;
        const response = await axios({
            method: method || 'GET',
            url,
            headers,
            data,
            validateStatus: () => true
        });

        res.json({
            status: response.status,
            headers: response.headers,
            data: response.data
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            details: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
