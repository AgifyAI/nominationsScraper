const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs').promises;

/**
 * Process a hospital to scrape contacts
 * This is a wrapper around the actual implementation in api/scrape.js
 */
async function processHospital(hospitalName, options) {
  const { processHospital } = require('./api/scrape');
  
  // If options is a browser instance, use it directly
  if (options && typeof options.newContext === 'function') {
    return processHospital(hospitalName, options);
  }
  
  // Otherwise, create a new browser with the provided options
  const browser = await chromium.launch({ 
    headless: options?.headless !== false
  });
  
  try {
    // Check if we should use cookie authentication
    if (options?.useCookies !== false) {
      console.log('Using cookie authentication in scraperCore.js');
      // We'll pass a special flag to indicate that api/scrape.js should use cookies
      const browserWithCookieFlag = {
        ...browser,
        useCookieAuth: true,
        originalBrowser: browser
      };
      return await processHospital(hospitalName, browserWithCookieFlag);
    } else {
      // Use traditional form authentication
      console.log('Using traditional form authentication in scraperCore.js');
      return await processHospital(hospitalName, browser);
    }
  } finally {
    await browser.close();
  }
}

module.exports = {
  processHospital
};
