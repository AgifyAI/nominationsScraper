const fs = require('node:fs').promises;
const path = require('node:path');
const { processHospital } = require('./scraperCore');

const hospitalNames = process.argv.slice(2);

if (hospitalNames.length === 0) {
    console.error('Please provide one or more hospital names as arguments');
    console.error('Usage: node scraper.js "HOSPITAL NAME 1" "HOSPITAL NAME 2" ...');
    process.exit(1);
}

(async () => {
    let allResults = [];
    const options = {
        headless: false,
        debugDir: path.join(process.cwd(), 'debug_search'),
        credentials: {
            email: 'mohammed@curecall.com',
            password: '?oLaea59rG7c?bLN'
        }
    };
    try {
        for (const hospitalName of hospitalNames) {
            const results = await processHospital(hospitalName, options);
            allResults = [...allResults, ...results];
        }
        if (allResults.length > 0) {
            const toCSV = allResults.map(r =>
                `"${r.etablissement}","${r.name}","${r.role || ''}","${r.date || ''}","${r.email || ''}","${r.phone || ''}","${r.otherPositions || ''}","${r.otherEstablishments || ''}"`
            );
            toCSV.unshift('"Établissement","Nom","Fonction","Date","Email","Téléphone","Autres fonctions","Autres établissements"');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputDir = path.join(process.cwd(), 'data');
            await fs.mkdir(outputDir, { recursive: true });
            const csvPath = path.join(outputDir, `leads_${timestamp}.csv`);
            await fs.writeFile(csvPath, toCSV.join('\n'), 'utf8');
            await fs.writeFile('leads.csv', toCSV.join('\n'), 'utf8');
            console.log(`Export terminé : ${allResults.length} contacts dans leads.csv et ${csvPath}`);
        } else {
            console.log('No contacts were found to export.');
        }
    } catch (err) {
        console.error(`Main execution error: ${err.message}`);
    }
})();
