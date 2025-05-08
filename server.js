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
db.defaults({ collections: [] }).write();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Get all collections
app.get('/api/collections', (req, res) => {
    const collections = db.get('collections').value();
    res.json(collections);
});

// Save a request to collection
app.post('/api/collections', (req, res) => {
    const { name, method, url, headers, body } = req.body;
    const newRequest = {
        id: Date.now().toString(),
        name,
        method,
        url,
        headers,
        body
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
                body: item.body || ''
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
