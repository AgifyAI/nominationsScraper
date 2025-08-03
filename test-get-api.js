const express = require('express');
const { processHospital } = require('./scraperCore');
const app = express();
const PORT = 3001; // Utiliser un port différent pour éviter les conflits

// Simuler la route GET /scrape
app.get('/scrape', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword parameter is required' });
    }
    
    console.log(`Testing GET /scrape with keyword: ${keyword}`);
    
    try {
        // Utiliser l'authentification par cookies
        const results = await processHospital(keyword, {
            headless: true,
            useCookies: true // Activer l'authentification par cookies
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

// Démarrer le serveur de test
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Testing GET /scrape?keyword=950000364...`);
    
    // Faire une requête à notre propre serveur pour tester
    const http = require('http');
    const testUrl = `http://localhost:${PORT}/scrape?keyword=950000364`;
    
    http.get(testUrl, (resp) => {
        let data = '';
        
        resp.on('data', (chunk) => {
            data += chunk;
        });
        
        resp.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('Test result:');
                console.log(`Status: Success`);
                console.log(`Found ${result.count} contacts`);
                console.log('First few contacts:');
                if (result.results && result.results.length > 0) {
                    result.results.slice(0, 3).forEach((contact, i) => {
                        console.log(`Contact ${i+1}: ${contact.name} - ${contact.email || 'No email'} - ${contact.phone || 'No phone'}`);
                    });
                }
            } catch (err) {
                console.error('Error parsing test result:', err);
                console.log('Raw response:', data);
            }
            
            // Arrêter le serveur après le test
            process.exit(0);
        });
    }).on('error', (err) => {
        console.error('Test request error:', err.message);
        process.exit(1);
    });
});
