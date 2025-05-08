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
