const { default: scrapeApi } = require('./api/scrape');

// Créer un objet de requête et de réponse simulés
const req = {
  method: 'POST',
  body: {
    hospital: '950000364'  // L'identifiant d'hôpital à tester
  }
};

const res = {
  status: (code) => {
    console.log(`Response status: ${code}`);
    return res;
  },
  json: (data) => {
    console.log('Response data:');
    console.log(JSON.stringify(data, null, 2));
    return res;
  },
  setHeader: (name, value) => {
    console.log(`Setting header ${name}: ${value}`);
    return res;
  },
  end: () => {
    console.log('Response ended');
    return res;
  }
};

// Appeler l'API
(async () => {
  console.log('Testing API with hospital ID: 950000364');
  try {
    await scrapeApi(req, res);
    console.log('API test completed');
  } catch (error) {
    console.error('Error during API test:', error);
  }
})();
