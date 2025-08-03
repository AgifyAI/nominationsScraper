const { processHospital } = require('./scraperCore');

// L'ID d'hôpital à tester
const hospitalId = '950000364';

(async () => {
  console.log(`Testing scraper with hospital ID: ${hospitalId} using cookie authentication`);
  
  try {
    // Appeler processHospital avec l'authentification par cookies
    const results = await processHospital(hospitalId, {
      headless: true,
      useCookies: true // Activer l'authentification par cookies
    });
    
    console.log(`\nScraping results for hospital ID ${hospitalId}:`);
    console.log(`Found ${results.length} contacts`);
    
    if (results.length > 0) {
      console.log('\nContact details:');
      results.forEach((contact, i) => {
        console.log(`\nContact ${i+1}:`);
        console.log(`- Name: ${contact.name || 'N/A'}`);
        console.log(`- Role: ${contact.role || 'N/A'}`);
        console.log(`- Email: ${contact.email || 'N/A'}`);
        console.log(`- Phone: ${contact.phone || 'N/A'}`);
        if (contact.otherPositions) console.log(`- Other positions: ${contact.otherPositions}`);
        if (contact.otherEstablishments) console.log(`- Other establishments: ${contact.otherEstablishments}`);
      });
      
      console.log('\nTest completed successfully!');
    } else {
      console.log('No contacts found for this hospital ID.');
    }
  } catch (error) {
    console.error('Error during scraping test:', error);
  }
})();
