const express = require('express');
const { processHospital } = require('./scraperCore');
const fs = require('node:fs/promises');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration for the scraper
const HEADLESS = true; // Always run headless in production API

// Middleware
app.use(express.json());

// Routes
app.get('/scrape', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword parameter is required' });
    }
    try {
        const results = await processHospital(keyword, {
            headless: true,
            credentials: {
                email: 'mohammed@curecall.com',
                password: '?oLaea59rG7c?bLN'
            }
        });
        return res.json({
            keyword,
            count: results.length,
            results
        });
    } catch (error) {
        console.error('Scraper error:', error);
        return res.status(500).json({
            error: 'An error occurred while scraping',
            message: error.message
        });
    }
});

// Add a simple health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Scraper API is running' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 