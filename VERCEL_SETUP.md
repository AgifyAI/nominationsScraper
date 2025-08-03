# Setting Up Vercel Environment for the Scraper

To make the scraper work on Vercel, you need to set up the cookies as an environment variable.

## Step 1: Export your cookies to a JSON string

1. First, locate your `cookies.json` file on your local machine.

2. Get the content of this file and convert it into a string format for the environment variable:

```bash
# On macOS/Linux
cat cookies.json | tr -d '\n' | tr -d ' '
```

This will output a compact JSON string without any newlines or extra spaces.

## Step 2: Add the environment variable to Vercel

1. Go to your Vercel dashboard for the project: https://vercel.com/dashboard

2. Select your project (nominations-scraper-v3)

3. Go to "Settings" → "Environment Variables"

4. Add a new environment variable:
   - Name: `COOKIES`
   - Value: (paste the JSON string you obtained in Step 1)
   - Environment: Production (check this option)

5. Click "Save"

## Step 3: Redeploy your application

1. Trigger a new deployment from the Vercel dashboard by clicking "Redeploy" 
   - Or push a new commit to your repository

## Verify the setup

After deployment is complete, test your API with a simple request:

```bash
curl -X POST https://nominations-scraper-v3.vercel.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"hospital":"CHU de Rennes"}'
```

## Troubleshooting

If you're still experiencing issues:

1. Check Vercel's function logs for error messages
2. Verify that your cookies are still valid (they might expire)
3. Make sure the cookies JSON is properly formatted without extra characters 