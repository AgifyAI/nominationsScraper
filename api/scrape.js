const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs').promises;

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

function formatSearchTerms(terms) {
  return terms.replace(/\s+/g, '+');
}

async function extractEmail(page) {
  try {
    const emailElements = await page.$$('.fas.fa-at, .far.fa-at, .fa-at');
    
    for (const element of emailElements) {
      const parentNode = await element.evaluateHandle(el => el.parentNode);
      const text = await parentNode.evaluate(el => el.textContent.trim());
      if (text && text.includes('@')) {
        return text.replace('', '').trim();
      }
    }
    
    const emailListItems = await page.$$('ul.no-bullet li');
    for (const item of emailListItems) {
      const text = await item.evaluate(el => el.textContent.trim());
      if (text.includes('@')) {
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

async function extractPhone(page) {
  try {
    const phoneElements = await page.$$('.fas.fa-phone, .far.fa-phone, .fa-phone');
    
    for (const element of phoneElements) {
      const parentNode = await element.evaluateHandle(el => el.parentNode);
      const text = await parentNode.evaluate(el => el.textContent.trim());
      if (text && /\d{2}\s\d{2}/.test(text)) {
        return text.replace('', '').trim();
      }
    }
    
    const phoneListItems = await page.$$('ul.no-bullet li');
    for (const item of phoneListItems) {
      const text = await item.evaluate(el => el.textContent.trim());
      if (/\d{2}\s\d{2}\s\d{2}\s\d{2}\s\d{2}/.test(text) || 
          /\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{2}/.test(text) ||
          /\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/.test(text)) {
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

async function extractAdditionalInfo(page) {
  try {
    const positions = [];
    const positionElements = await page.$$('.panel-avatar--content .text-large b');
    
    for (const element of positionElements) {
      const position = await element.evaluate(el => el.textContent.trim());
      positions.push(position);
    }
    
    const establishments = [];
    const establishmentElements = await page.$$('.panel-avatar--content .text-medium a');
    
    for (const element of establishmentElements) {
      const establishment = await element.evaluate(el => el.textContent.trim());
      establishments.push(establishment);
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

async function scrapeContacts(page, hospitalName) {
  console.log('Starting to scrape contacts...');
  const contacts = [];
  
  try {
    const debugDir = path.join(process.cwd(), 'debug');
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
          const role = await roleElement?.evaluate(el => el.textContent.trim());
          const date = await dateElement?.evaluate(el => el.textContent.trim());
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

async function processHospital(hospitalName, browser) {
  console.log(`\n========== Processing hospital: ${hospitalName} ==========\n`);
  
  // Check if we should use cookie authentication (flag set in scraperCore.js)
  const useCookieAuth = browser.useCookieAuth === true;
  
  // If we're using cookie auth with a wrapped browser, use the original browser
  const actualBrowser = browser.originalBrowser || browser;
  
  if (useCookieAuth) {
    console.log('Using cookie-based authentication...');
  } else {
    console.log('Using traditional form-based authentication...');
  }
  
  // Create a new browser context
  console.log('Creating browser context...');
  
  let context;
  let page;
  let contacts = [];
  
  try {
    
    if (useCookieAuth) {
      // ===== COOKIE-BASED AUTHENTICATION =====
      console.log('Initializing cookie-based authentication...');
      
      // Load cookies from the cookies.json file
      const cookiesPath = path.join(process.cwd(), 'cookies.json');
      let cookies = [];
      
      try {
        const cookiesData = await fs.readFile(cookiesPath, 'utf8');
        cookies = JSON.parse(cookiesData);
        console.log(`Successfully loaded ${cookies.length} cookies from ${cookiesPath}`);
      } catch (err) {
        console.error(`Error loading cookies from ${cookiesPath}: ${err.message}`);
        console.log('Falling back to cookies_temp.json...');
        
        // Try to load from the backup file
        try {
          const backupCookiesPath = path.join(process.cwd(), 'cookies_temp.json');
          const backupCookiesData = await fs.readFile(backupCookiesPath, 'utf8');
          cookies = JSON.parse(backupCookiesData);
          console.log(`Successfully loaded ${cookies.length} cookies from backup file`);
        } catch (backupErr) {
          console.error(`Error loading backup cookies: ${backupErr.message}`);
          throw new Error('Failed to load authentication cookies. Cannot proceed with scraping.');
        }
      }
      
      // Create a new context with the cookies
      context = await actualBrowser.newContext();
      
      // Normalize cookie format before adding them to the context
      const normalizedCookies = cookies.map(cookie => {
        // Create a new cookie object to avoid modifying the original
        const normalizedCookie = { ...cookie };
        
        // Fix sameSite property - must be one of Strict, Lax, or None (with capital first letter)
        if (normalizedCookie.sameSite) {
          if (normalizedCookie.sameSite.toLowerCase() === 'lax') {
            normalizedCookie.sameSite = 'Lax';
          } else if (normalizedCookie.sameSite.toLowerCase() === 'strict') {
            normalizedCookie.sameSite = 'Strict';
          } else if (normalizedCookie.sameSite.toLowerCase() === 'none') {
            normalizedCookie.sameSite = 'None';
          } else {
            // If it's an invalid value, remove it
            delete normalizedCookie.sameSite;
          }
        }
        
        // Remove any non-standard properties that Playwright doesn't expect
        if ('id' in normalizedCookie) delete normalizedCookie.id;
        if ('storeId' in normalizedCookie) delete normalizedCookie.storeId;
        if ('hostOnly' in normalizedCookie) delete normalizedCookie.hostOnly;
        
        return normalizedCookie;
      });
      
      console.log(`Normalized ${normalizedCookies.length} cookies for Playwright format`);
      
      // Add the normalized cookies to the context
      await context.addCookies(normalizedCookies);
      console.log('Added authentication cookies to browser context');
      
      // Create a new page in the context
      page = await context.newPage();
      
      // Take a screenshot of cookies being set
      try {
        const debugDir = path.join(process.cwd(), 'screenshots');
        await ensureDirectoryExists(debugDir);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(debugDir, `${timestamp}_cookies_set.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved after setting cookies: ${path.basename(screenshotPath)}`);
      } catch (err) {
        console.error(`Error saving cookies screenshot: ${err.message}`);
      }
      
      // Navigate directly to the search URL (we should already be authenticated)
      console.log('Navigating directly to search URL with authentication cookies...');
      const formattedHospitalName = formatSearchTerms(hospitalName);
      const searchUrl = `https://app.nominations.hospimedia.fr/searches?utf8=%E2%9C%93&terms=${encodeURIComponent(formattedHospitalName)}`;
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      }).catch(err => {
        console.error(`Error navigating to search URL: ${err.message}`);
        throw new Error(`Failed to navigate to the search page for "${hospitalName}".`);
      });
      console.log('Successfully navigated to search URL');
      
      // Check if we're authenticated by looking for elements that only appear when logged in
      console.log('Verifying authentication status...');
      const isAuthenticated = await page.evaluate(() => {
        // Check for elements that indicate we're logged in
        const logoutLink = document.querySelector('a[href*="/logout"], a.logout, .user-menu');
        const userMenu = document.querySelector('.user-dropdown, .user-profile, .avatar');
        const searchForm = document.querySelector('form.search-form, .search-bar');
        
        return !!(logoutLink || userMenu || searchForm);
      });
      
      if (!isAuthenticated) {
        console.error('Not authenticated! Cookie-based authentication failed.');
        
        // Take a screenshot to see what happened
        const debugDir = path.join(process.cwd(), 'screenshots');
        await ensureDirectoryExists(debugDir);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(debugDir, `${timestamp}_authentication_failed.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Authentication failure screenshot saved: ${path.basename(screenshotPath)}`);
        
        // Save the HTML content for debugging
        const htmlPath = path.join(debugDir, `${timestamp}_authentication_failed.html`);
        const html = await page.content();
        await fs.writeFile(htmlPath, html);
        console.log(`Authentication failure HTML saved: ${path.basename(htmlPath)}`);
        
        throw new Error('Authentication with cookies failed. The cookies may have expired.');
      }
      
      console.log('Successfully authenticated using cookies!');
      
    } else {
      // ===== FORM-BASED AUTHENTICATION =====
      console.log('Initializing form-based authentication...');
      
      // Create a new context
      context = await actualBrowser.newContext();
      page = await context.newPage();
      
      // 1. Go to the main page (login form is here)
      console.log('Navigating to main page...');
      await page.goto('https://app.nominations.hospimedia.fr/', { 
        waitUntil: 'networkidle', 
        timeout: 60000 
      }).catch(err => {
        console.error(`Error navigating to main page: ${err.message}`);
        throw new Error('Failed to load the main page. Please check your internet connection.');
      });
      console.log('Successfully navigated to main page (login page)');
      
      // Take a screenshot of the login page
      try {
        const debugDir = path.join(process.cwd(), 'screenshots');
        await ensureDirectoryExists(debugDir);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(debugDir, `${timestamp}_login_page_initial.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Initial login page screenshot saved: ${path.basename(screenshotPath)}`);
      } catch (err) {
        console.error(`Error saving initial login page screenshot: ${err.message}`);
      }
      
      // IMPORTANT: Check for cookie popup first and close it before doing anything else
      console.log('Checking for cookie popup...');
      try {
        // Wait a short time for the cookie popup to appear
        await page.waitForTimeout(1000);
        
        // Try multiple possible selectors for cookie consent buttons
        const cookieSelectors = [
          '#didomi-notice-agree-button',
          'button:has-text("Ok pour moi")',
          'button:has-text("Accepter")',
          'button:has-text("J\'accepte")',
          '.cookie-notice .accept',
          '.cookie-banner .accept',
          '#cookie-consent-accept',
          '.didomi-continue-without-agreeing',
          '.didomi-components-button'
        ];
        
        for (const selector of cookieSelectors) {
          const cookieButton = await page.$(selector);
          if (cookieButton) {
            console.log(`Cookie popup found with selector: ${selector}, closing it...`);
            await cookieButton.click();
            console.log('Clicked on cookie popup button');
            await page.waitForTimeout(1500); // Wait for popup to disappear
            break;
          }
        }
      } catch (err) {
        console.error(`Error handling cookie popup: ${err.message}`);
        console.log('Continuing despite cookie popup error');
      }

      // 2. Now wait for and fill the login form
      console.log('Waiting for login form to be available...');
      // Find email input with multiple possible selectors
      const emailSelector = await page.waitForSelector('input#user_email, input[type="email"], input[name="user[email]"]', { timeout: 10000 })
        .catch(err => {
          console.error(`Error finding email input: ${err.message}`);
          throw new Error('Login form not found on the page. The website structure may have changed.');
        });
      console.log('Email input field found');
      
      // Find password input with multiple possible selectors
      const passwordSelector = await page.waitForSelector('input#user_password, input[type="password"], input[name="user[password]"]', { timeout: 5000 })
        .catch(err => {
          console.error(`Error finding password input: ${err.message}`);
          throw new Error('Password field not found on the page. The website structure may have changed.');
        });
      console.log('Password input field found');
      
      // Fill login credentials
      const email = 'mohammed@curecall.com';
      const password = '?oLaea59rG7c?bLN';
      
      console.log('Filling login credentials...');
      // Get the actual email and password input elements
      const emailInput = await page.$('input#user_email, input[type="email"], input[name="user[email]"]');
      const passwordInput = await page.$('input#user_password, input[type="password"], input[name="user[password]"]');
      
      if (!emailInput || !passwordInput) {
        throw new Error('Could not find email or password input fields');
      }
      
      // Clear the fields first
      await emailInput.fill('');
      await passwordInput.fill('');
      
      // Fill in the credentials
      await emailInput.type(email, { delay: 50 });
      await passwordInput.type(password, { delay: 50 });
      
      // 3. Find and click the login button
      console.log('Looking for login button...');
      // Try multiple possible selectors for the login button
      const loginButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button:has-text("Connexion")',
        'button:has-text("Se connecter")',
        'button:has-text("Login")',
        '.login-button',
        '.submit-button'
      ];
      
      let loginButton = null;
      for (const selector of loginButtonSelectors) {
        loginButton = await page.$(selector);
        if (loginButton) {
          console.log(`Login button found with selector: ${selector}`);
          break;
        }
      }
      
      if (!loginButton) {
        throw new Error('Could not find login button on the page');
      }
      
      // Click the login button and wait for navigation
      console.log('Clicking login button and waiting for navigation...');
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          loginButton.click()
        ]);
      } catch (err) {
        console.error(`Error during login process: ${err.message}`);
        throw new Error('Failed to log in. The login process was interrupted or timed out.');
      }
      console.log('Successfully logged in, landed on dashboard/home');
      
      // Navigate to the search URL
      console.log('Navigating to search URL...');
      const formattedHospitalName = formatSearchTerms(hospitalName);
      const searchUrl = `https://app.nominations.hospimedia.fr/searches?utf8=%E2%9C%93&terms=${encodeURIComponent(formattedHospitalName)}`;
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      }).catch(err => {
        console.error(`Error navigating to search URL: ${err.message}`);
        throw new Error(`Failed to navigate to the search page for "${hospitalName}".`);
      });
      console.log('Successfully navigated to search URL');
    }
    
    // Take a screenshot of the search page
    try {
      const debugDir = path.join(process.cwd(), 'screenshots');
      await ensureDirectoryExists(debugDir);
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotPath = path.join(debugDir, `${timestamp}_search_page.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot of search page saved: ${path.basename(screenshotPath)}`);
    } catch (err) {
      console.error(`Error saving search page screenshot: ${err.message}`);
    }
    
    // Wait for content to load
    console.log('Waiting for search results to load...');
    await page.waitForTimeout(2000);

    // Check for cookie popup after authentication (sometimes it still appears)
    console.log('Checking for cookie consent popup after authentication...');
    const cookiePopup = await page.$('#didomi-notice-agree-button, button:has-text("Ok pour moi"), .cookie-notice .accept, .cookie-banner .accept');
    if (cookiePopup) {
      console.log('Cookie popup found, closing it...');
      await cookiePopup.click().catch(err => {
        console.error(`Error closing cookie popup: ${err.message}`);
        console.log('Continuing despite cookie popup error');
      });
      await page.waitForTimeout(1000); // Wait for popup animation to complete
      console.log('Closed cookies popup');
    } else {
      console.log('No cookie popup detected or it was already accepted');
    }

    
    // Save a screenshot of the search results for debugging
    try {
      const debugDir = path.join(process.cwd(), 'screenshots');
      await ensureDirectoryExists(debugDir);
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotPath = path.join(debugDir, `${timestamp}_search_results_${hospitalName.replace(/[^a-z0-9]/gi, '_')}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved successfully: ${path.basename(screenshotPath)} (${(await fs.stat(screenshotPath)).size} bytes)`);
    } catch (err) {
      console.error(`Error saving screenshot: ${err.message}`);
    }
    
    // Enhanced debugging for search results page
    console.log('[' + new Date().toISOString() + '] Looking for hospital link in search results...');
    
    // Check if we're on a "no results" page
    const noResultsText = await page.$$eval('.search-results, .results, .result-list, .content', elements => {
      for (const el of elements) {
        const text = el.textContent.toLowerCase();
        if (text.includes('aucun résultat') || text.includes('no results') || text.includes('0 résultat')) {
          return el.textContent.trim();
        }
      }
      return null;
    });
    
    if (noResultsText) {
      console.log(`No results found message detected: "${noResultsText}"`);
      console.log('Trying direct navigation to hospital page instead of search...');
      
      // Try direct navigation to the hospital page using the hospital ID
      if (/^\d+$/.test(hospitalName)) {
        console.log(`Hospital name "${hospitalName}" appears to be an ID, trying direct navigation...`);
        const directUrl = `https://app.nominations.hospimedia.fr/entities/${hospitalName}`;
        console.log(`Attempting direct navigation to: ${directUrl}`);
        
        await page.goto(directUrl, { waitUntil: 'networkidle' });
        
        // Check if we landed on a valid hospital page
        const hospitalTitle = await page.$('h1.entity-title, h1.hospital-title, h1.title');
        if (hospitalTitle) {
          const title = await hospitalTitle.evaluate(el => el.textContent.trim());
          console.log(`Successfully navigated directly to hospital: "${title}"`);
          
          // Scrape contacts from the hospital page
          contacts = await scrapeContacts(page, hospitalName);
          return;
        } else {
          console.log('Direct navigation failed - not a valid hospital page');
        }
      }
    }
    
    // Log all links on the page for debugging
    const allLinks = await page.$$('a');
    console.log(`Found ${allLinks.length} total links on the page`);
    
    // Check for any search result elements
    const searchResults = await page.$$('.search-result, .result-item, .entity-result, .entity');
    console.log(`Found ${searchResults.length} search result elements`);
    
    // Look for hospital links with the original selector
    const hospitalLinks = await page.$$('a[href*="/entities/"]');
    console.log(`Found ${hospitalLinks.length} links matching 'a[href*="/entities/"]'`);
    
    // Try alternative selectors that might contain hospital links
    const alternativeLinks = await page.$$('a[href*="hospital"], a[href*="clinique"], a[href*="chu"], a.search-result-link, a.result-link, .result a');
    console.log(`Found ${alternativeLinks.length} links with alternative selectors`);
    
    // Log the first 5 links on the page to see what's available
    if (allLinks.length > 0) {
      console.log('Sample of links found on the page:');
      for (let i = 0; i < Math.min(5, allLinks.length); i++) {
        try {
          const href = await allLinks[i].evaluate(el => el.href || 'No href');
          const text = await allLinks[i].evaluate(el => el.textContent.trim() || 'No text');
          console.log(`Link ${i+1}: Text="${text}", href="${href}"`);
        } catch (err) {
          console.log(`Error getting link ${i+1} details: ${err.message}`);
        }
      }
    }
    
    // Try a more general approach - look for any link that might be a result
    const resultLinks = await page.$$('.search-results a, .results a, .result a, .entity a');
    console.log(`Found ${resultLinks.length} potential result links`);
    
    // Check if there's a "Un résultat" heading, which indicates a single result
    const singleResultHeading = await page.$('h1:has-text("Un résultat"), h2:has-text("Un résultat"), .heading:has-text("Un résultat")');
    if (singleResultHeading) {
      console.log('"Un résultat" heading found - this indicates a single search result');
      
      // Look for any clickable link in the results area
      const resultsArea = await page.$('.search-results, .results, .result-list, .content');
      if (resultsArea) {
        const linksInResults = await resultsArea.$$('a');
        if (linksInResults.length > 0) {
          const link = linksInResults[0];
          const linkText = await link.evaluate(el => el.textContent.trim());
          const hospitalUrl = await link.evaluate(el => el.href);
          console.log(`Found result link in single result area: "${linkText}"`);
          console.log('Hospital URL:', hospitalUrl);
          
          // Navigate to the hospital page
          await page.goto(hospitalUrl, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1500);
          
          // Scrape contacts from the hospital page
          contacts = await scrapeContacts(page, hospitalName);
          return;
        }
      }
    }
    
    if (hospitalLinks.length > 0) {
      // Simply take the first hospital link without trying to match names
      const link = hospitalLinks[0];
      const linkText = await link.evaluate(el => el.textContent.trim());
      const hospitalUrl = await link.evaluate(el => el.href);
      console.log(`Found hospital link: "${linkText}"`);
      console.log('Hospital URL:', hospitalUrl);
      
      // Navigate to the hospital page
      await page.goto(hospitalUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      
      // Scrape contacts from the hospital page
      contacts = await scrapeContacts(page, hospitalName);
    } 
    // Try using alternative links if available
    else if (alternativeLinks.length > 0 || resultLinks.length > 0) {
      const linksToTry = alternativeLinks.length > 0 ? alternativeLinks : resultLinks;
      const link = linksToTry[0];
      const linkText = await link.evaluate(el => el.textContent.trim());
      const hospitalUrl = await link.evaluate(el => el.href);
      console.log(`Found alternative link: "${linkText}"`);
      console.log('Alternative URL:', hospitalUrl);
      
      // Navigate to the page
      await page.goto(hospitalUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      
      // Scrape contacts
      contacts = await scrapeContacts(page, hospitalName);
    }
    else {
      console.log('[' + new Date().toISOString() + '] No hospital link found in search results. Dumping search results HTML for debugging.');
      try {
        const html = await page.content();
        const debugDir = path.join(process.cwd(), 'debug');
        await ensureDirectoryExists(debugDir);
        await fs.writeFile(path.join(debugDir, `search_results_${hospitalName.replace(/[^a-z0-9]/gi, '_')}.html`), html);
        console.log(`Saved search results HTML to debug/search_results_${hospitalName.replace(/[^a-z0-9]/gi, '_')}.html`);
      } catch (err) {
        console.error(`Error saving debug HTML: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`Error processing hospital "${hospitalName}": ${err.message}`);
  } finally {
    if (context) {
      await context.close();
    }
  }
  
  return contacts.map(contact => ({
    etablissement: hospitalName,
    ...contact
  }));
}

module.exports = {
  processHospital
};

module.exports.default = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

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
    
    // Launch the browser in headless mode for Vercel
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
}; 