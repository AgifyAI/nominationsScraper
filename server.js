const express = require('express');
const { exec } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs').promises;
const bodyParser = require('body-parser');
const { processHospital } = require('./scraperCore');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Scraper functions

  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}


  return terms.replace(/\s+/g, '+');
}


  try {
    const emailElements = await page.$$('.fas.fa-at, .far.fa-at, .fa-at');
    
    for (const element of emailElements) {
      const parentNode = await element.evaluateHandle(el => el.parentNode);
      const text = await parentNode.evaluate(el => el?.textContent?.trim());
      if (text && text.includes('@')) {
        return text.replace('', '').trim();
      }
    }
    
    const emailListItems = await page.$$('ul.no-bullet li');
    for (const item of emailListItems) {
      const text = await item.evaluate(el => el?.textContent?.trim());
      if (text && text.includes('@')) {
        return text.replace(/^[^\w@]+/, '').trim();
      }
    }
    
    const emailElement = await page.$('a[href^="mailto:"]');
    if (emailElement) {
      const emailHref = await emailElement.evaluate(el => el.href);
      return emailHref.replace('mailto:', '').split('?')[0];
    }
  } catch (error) {
    console.error('Error extracting email:', error);
  }
  return '';
}


  try {
    const phoneElements = await page.$$('.fas.fa-phone, .far.fa-phone, .fa-phone');
    
    for (const element of phoneElements) {
      const parentNode = await element.evaluateHandle(el => el.parentNode);
      const text = await parentNode.evaluate(el => el?.textContent?.trim());
      if (text && /\d{2}\s\d{2}/.test(text)) {
        return text.replace('', '').trim();
      }
    }
    
    const phoneListItems = await page.$$('ul.no-bullet li');
    for (const item of phoneListItems) {
      const text = await item.evaluate(el => el?.textContent?.trim());
      if (text && (/\d{2}\s\d{2}\s\d{2}\s\d{2}\s\d{2}/.test(text) || 
          /\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{2}/.test(text) ||
          /\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/.test(text))) {
        return text.replace(/^[^\d]+/, '').trim();
      }
    }
    
    const phoneElement = await page.$('a[href^="tel:"]');
    if (phoneElement) {
      const phoneHref = await phoneElement.evaluate(el => el.href);
      return phoneHref.replace('tel:', '');
    }
  } catch (error) {
    console.error('Error extracting phone:', error);
  }
  return '';
}


  try {
    const positions = [];
    const positionElements = await page.$$('.panel-avatar--content .text-large b');
    
    for (const element of positionElements) {
      const position = await element.evaluate(el => el?.textContent?.trim());
      if (position) positions.push(position);
    }
    
    const establishments = [];
    const establishmentElements = await page.$$('.panel-avatar--content .text-medium a');
    
    for (const element of establishmentElements) {
      const establishment = await element.evaluate(el => el?.textContent?.trim());
      if (establishment) establishments.push(establishment);
    }
    
    return {
      allPositions: positions.length > 1 ? positions.join('; ') : '',
      otherEstablishments: establishments.length > 1 ? establishments.join('; ') : ''
    };
  } catch (error) {
    console.error('Error extracting additional info:', error);
    return { allPositions: '', otherEstablishments: '' };
  }
}


  console.log('Starting to scrape contacts...');
  const contacts = [];
  
  try {
    const tempDir = process.env.TEMP_DIR || '/tmp';
    const debugDir = path.join(tempDir, 'debug');
    await ensureDirectoryExists(debugDir);
    const html = await page.content();
    const safeHospitalName = hospitalName.replace(/[^a-z0-9]/gi, '_');
    await fs.writeFile(path.join(debugDir, `${safeHospitalName}_hospital_page.html`), html);
    console.log('Saved debug HTML of hospital page');

    const directionSection = await page.$('h2:has-text("Équipe de direction")');
    if (!directionSection) {
      console.log('Could not find "Équipe de direction" section');
      return contacts;
    }
    
    // First, count the initial number of contact cards
    const initialContactCards = await page.$$('.card-friends');
    const initialCount = initialContactCards.length;
    console.log(`Initial contact count: ${initialCount}`);
    
    // Check if there's a "load more" button and click it to expand all contacts
    const loadMoreButton = await page.$('a.all-people.fold.icon-fold-active');
    if (loadMoreButton) {
      console.log('Found "load more" button, clicking to expand all contacts...');
      
      try {
        // Try method 1: click the button to load more contacts
        await loadMoreButton.click();
        
        // Wait for the rendering
        await page.waitForTimeout(1000);
                
        // Verify that more contacts were loaded
        const expandedContactCards = await page.$$('.card-friends');
        const expandedCount = expandedContactCards.length;
        
        if (expandedCount > initialCount) {
          console.log(`Expanded contacts list: ${initialCount} → ${expandedCount}`);
        } else {
          console.log('No additional contacts were loaded by clicking');
        }
      } catch (error) {
        console.error(`Error expanding contacts: ${error.message}`);
      }
    } else {
      console.log('No "load more" button found, assuming all contacts are already visible');
    }

    // Get all contact cards after all expansion attempts
    const contactCards = await page.$$('.card-friends');
    console.log(`Found ${contactCards.length} contact cards total`);
    
    // Combined approach: get cards from both main area and "more" section if present
    const allCards = contactCards;
    console.log(`Processing ${allCards.length} unique contact cards`);

    const contactsData = [];
    for (const card of allCards) {
      try {
        const nameElement = await card.$('.card-friends--name a');
        const roleElement = await card.$('.card-friends--job');
        const dateElement = await card.$('.card-friends--date span');

        if (nameElement) {
          const name = await nameElement.evaluate(el => el.textContent.trim());
          const role = roleElement ? await roleElement.evaluate(el => el.textContent.trim()) : '';
          const date = dateElement ? await dateElement.evaluate(el => el.textContent.trim()) : '';
          const profileUrl = await nameElement.evaluate(el => el.href);

          // Check for duplicates
          const isDuplicate = contactsData.some(contact => contact.profileUrl === profileUrl);
          if (!isDuplicate) {
            contactsData.push({
              name,
              role,
              date,
              profileUrl
            });
          }
        }
      } catch (error) {
        console.error('Error collecting basic contact info:', error);
      }
    }
    
    console.log(`Collected basic info for ${contactsData.length} unique contacts`);
    
    for (const contact of contactsData) {
      try {
        console.log(`Visiting profile: ${contact.profileUrl}`);
        
        await page.goto(contact.profileUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        const email = await extractEmail(page);
        const phone = await extractPhone(page);
        
        const additionalInfo = await extractAdditionalInfo(page);
        
        contacts.push({
          ...contact,
          email,
          phone,
          otherPositions: additionalInfo.allPositions,
          otherEstablishments: additionalInfo.otherEstablishments
        });
        
        console.log(`Processed contact: ${contact.name} - Email: ${email} - Phone: ${phone}`);
        
      } catch (error) {
        console.error(`Error processing profile for ${contact.name}:`, error);
        contacts.push(contact);
      }
    }
  } catch (error) {
    console.error(`Error in scrapeContacts: ${error.message}`);
  }

  console.log(`Scraped ${contacts.length} contacts`);
  return contacts;
}

// processHospital is now imported from scraperCore.js
  console.log(`\n========== Processing hospital: ${hospitalName} ==========\n`);
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let contacts = [];
  
  try {
    // Get cookies from environment variable or file
    let cookies = [];
    try {
      const cookiesRaw = process.env.COOKIES;
      if (cookiesRaw) {
        cookies = JSON.parse(cookiesRaw);
      } else {
        // Try to read from file as fallback
        const cookiesData = await fs.readFile('cookies.json', 'utf8');
        cookies = JSON.parse(cookiesData);
      }
      await context.addCookies(cookies);
    } catch (err) {
      console.error(`Cookie loading error: ${err.message}`);
    }

    const searchUrl = `https://app.nominations.hospimedia.fr/searches?utf8=%E2%9C%93&terms=${encodeURIComponent(hospitalName)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });

    // Nouvelle fonction de normalisation pour comparaison souple
    function normalize(str) {
      return str
        .normalize("NFD")
        .replace(/[\p{Diacritic}]/gu, "")
        .replace(/[\s\-_]+/g, "")
        .toLowerCase();
    }

    const hospitalLinks = await page.$$('a[href*="/entities/"]');
    let hospitalUrl = null;
    const normalizedTarget = normalize(hospitalName);

    for (const link of hospitalLinks) {
      const linkText = await link.evaluate(el => el.textContent.trim());
      const normalizedLinkText = normalize(linkText);

      // Correspondance souple : le nom recherché est contenu dans le texte du lien ou inversement
      if (
        normalizedLinkText.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedLinkText)
      ) {
        hospitalUrl = await link.evaluate(el => el.href);
        break;
      }
    }

    if (!hospitalUrl) {
      console.error(`No close match found for "${hospitalName}"`);
      return [];
    }

    console.log('Hospital URL:', hospitalUrl);

    await page.goto(hospitalUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    contacts = await scrapeContacts(page, hospitalName);
  } catch (err) {
    console.error(`Error processing hospital "${hospitalName}": ${err.message}`);
  } finally {
    await context.close();
  }
  
  return contacts.map(contact => ({
    etablissement: hospitalName,
    ...contact
  }));
}

// Routes
app.get('/', (req, res) => {
  // Serve a simple HTML form
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hospimedia Nominations Scraper</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        form {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
        }
        input[type="text"] {
          width: 100%;
          padding: 8px;
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        button {
          background: #4CAF50;
          color: white;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background: #45a049;
        }
        .api-docs {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 5px;
        }
        pre {
          background: #eee;
          padding: 10px;
          overflow: auto;
        }
        #loading {
          display: none;
          margin-top: 20px;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 2s linear infinite;
          margin-right: 10px;
          display: inline-block;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <h1>Hospimedia Nominations Scraper</h1>
      
      <form id="scraperForm">
        <div>
          <label for="hospital">Nom de l'établissement :</label>
          <input type="text" id="hospital" name="hospital" placeholder="ex: CHU de Rennes" required>
        </div>
        <button type="submit">Lancer le scraping</button>
      </form>
      
      <div id="loading">
        <div class="spinner"></div>
        <span>Scraping en cours... Cela peut prendre quelques minutes.</span>
      </div>
      
      <div id="results"></div>
      
      <div class="api-docs">
        <h2>API Documentation</h2>
        <p>Pour utiliser directement l'API :</p>
        
        <h3>Endpoint</h3>
        <pre>POST /scrape</pre>
        
        <h3>Format de la requête</h3>
        <pre>
{
  "hospital": "Nom de l'établissement"
}
        </pre>
        
        <h3>Exemple avec cURL</h3>
        <pre>
curl -X POST ${req.protocol}://${req.get('host')}/scrape \\
  -H "Content-Type: application/json" \\
  -d '{"hospital":"CHU de Rennes"}'
        </pre>
      </div>
      
      <script>
        document.getElementById('scraperForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const hospital = document.getElementById('hospital').value;
          const loadingDiv = document.getElementById('loading');
          const resultsDiv = document.getElementById('results');
          
          // Show loading spinner
          loadingDiv.style.display = 'block';
          resultsDiv.innerHTML = '';
          
          try {
            const response = await fetch('/scrape', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ hospital })
            });
            
            const data = await response.json();
            
            // Hide loading spinner
            loadingDiv.style.display = 'none';
            
            if (data.success) {
              resultsDiv.innerHTML = \`
                <h3>Résultats</h3>
                <p>\${data.message}</p>
                <p>\${data.resultsCount} contacts trouvés</p>
                <h4>Données CSV</h4>
                <textarea style="width: 100%; height: 200px;">\${data.csvData}</textarea>
                <p><a href="data:text/csv;charset=utf-8,\${encodeURIComponent(data.csvData)}" download="contacts.csv">Télécharger CSV</a></p>
              \`;
            } else {
              resultsDiv.innerHTML = \`
                <h3>Erreur</h3>
                <p>\${data.error}</p>
                <p>\${data.message || ''}</p>
              \`;
            }
          } catch (error) {
            loadingDiv.style.display = 'none';
            resultsDiv.innerHTML = \`
              <h3>Erreur</h3>
              <p>Une erreur s'est produite lors de la communication avec le serveur</p>
              <p>\${error.message}</p>
            \`;
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// API route for scraping
app.post('/scrape', async (req, res) => {
  try {
    // Accept either a single hospital name or an array of hospitals
    let hospitalName;
    let hospitalsList = [];
    
    if (req.body.hospital) {
      // Single hospital name provided
      hospitalName = req.body.hospital;
      if (typeof hospitalName === 'string' && hospitalName.trim() !== '') {
        hospitalsList = [hospitalName];
      }
    } else if (req.body.hospitals && Array.isArray(req.body.hospitals) && req.body.hospitals.length > 0) {
      // Array of hospitals provided (backward compatibility)
      hospitalsList = req.body.hospitals;
    }
    
    if (hospitalsList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a hospital name in the "hospital" field or an array in "hospitals" field'
      });
    }

    console.log(`Received request to scrape: ${hospitalsList.join(', ')}`);
    
    // Launch the browser in headless mode
    const browser = await chromium.launch({ headless: true });
    let allResults = [];
    
    try {
      for (const hospital of hospitalsList) {
        const results = await processHospital(hospital, browser);
        allResults = [...allResults, ...results];
      }
      
      if (allResults.length > 0) {
        const toCSV = allResults.map(r =>
          `"${r.etablissement}","${r.name}","${r.role || ''}","${r.date || ''}","${r.email || ''}","${r.phone || ''}","${r.otherPositions || ''}","${r.otherEstablishments || ''}"`
        );
        toCSV.unshift('"Établissement","Nom","Fonction","Date","Email","Téléphone","Autres fonctions","Autres établissements"');
        
        const csvData = toCSV.join('\n');
        
        // Try to save the CSV to a file as well
        try {
          const tempDir = process.env.TEMP_DIR || '/tmp';
          const dataDir = path.join(tempDir, 'data');
          await ensureDirectoryExists(dataDir);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const csvPath = path.join(dataDir, `leads_${timestamp}.csv`);
          await fs.writeFile(csvPath, csvData, 'utf8');
          console.log(`Saved CSV to ${csvPath}`);
        } catch (saveError) {
          console.error(`Error saving CSV file: ${saveError.message}`);
        }
        
        res.json({
          success: true,
          message: `Successfully scraped ${hospitalsList.length} hospital(s)`,
          resultsCount: allResults.length,
          csvData: csvData
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No contacts were found',
          message: 'The scraper did not find any contacts for the specified hospital(s)'
        });
      }
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error(`Server error: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Scraper API is operational'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- GET /        - Web interface`);
  console.log(`- POST /scrape - Trigger scraper with hospital name`);
  console.log(`- GET /status  - Check server status`);
}); 