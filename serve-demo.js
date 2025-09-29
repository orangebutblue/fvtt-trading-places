#!/usr/bin/env node

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files
app.use('/styles', express.static('styles'));
app.use('/templates', express.static('templates'));

// Root route with demo interface
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Trading Places Demo</title>
    <link rel="stylesheet" href="/styles/data-management.css">
    <link rel="stylesheet" href="/styles/trading-dialog-enhanced.css">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .demo-link { display: block; margin: 10px 0; padding: 10px; background: #f0f0f0; text-decoration: none; color: #333; }
        .demo-link:hover { background: #e0e0e0; }
    </style>
</head>
<body>
    <h1>Trading Places Demo</h1>
    <p>Click the links below to view the interfaces:</p>
    
    <a href="/data-management" class="demo-link">
        📊 Data Management Interface
    </a>
    
    <a href="/trading-dialog" class="demo-link">
        🏪 Enhanced Trading Dialog
    </a>
    
    <a href="/templates" class="demo-link">
        📄 Raw Templates Directory
    </a>
</body>
</html>
    `);
});

// Serve data management interface
app.get('/data-management', (req, res) => {
    const templatePath = path.join(__dirname, 'templates/data-management.hbs');
    if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Data Management</title>
    <link rel="stylesheet" href="/styles/data-management.css">
</head>
<body>
${template}
</body>
</html>
        `);
    } else {
        res.send('Template not found');
    }
});

// Serve trading dialog
app.get('/trading-dialog', (req, res) => {
    const templatePath = path.join(__dirname, 'templates/trading-dialog-enhanced.hbs');
    if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Trading Dialog</title>
    <link rel="stylesheet" href="/styles/trading-dialog-enhanced.css">
</head>
<body>
${template}
</body>
</html>
        `);
    } else {
        res.send('Template not found');
    }
});

app.listen(port, () => {
    console.log(`Demo server running at http://localhost:${port}`);
    console.log('Opening browser...');
    
    // Auto-open browser
    open(`http://localhost:${port}`);
});