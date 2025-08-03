# Scraper API

A simple Express API wrapper for a web scraper that extracts contact information from the Hospimedia Nominations platform.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `cookies.json` file with valid Hospimedia authentication cookies.

3. Start the server:
   ```
   npm start
   ```

## API Endpoints

### GET /

A simple health check endpoint to verify the API is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Scraper API is running"
}
```

### GET /scrape

Scrapes contact information for a given hospital or organization.

**Query Parameters:**
- `keyword` (required): The name of the hospital or organization to search for

**Example Request:**
```
GET /scrape?keyword=CHU%20de%20Bordeaux
```

**Example Response:**
```json
{
  "keyword": "CHU de Bordeaux",
  "count": 5,
  "results": [
    {
      "etablissement": "CHU de Bordeaux",
      "name": "John Doe",
      "role": "Directeur",
      "date": "01/01/2023",
      "profileUrl": "https://app.nominations.hospimedia.fr/people/12345",
      "email": "john.doe@example.com",
      "phone": "01 23 45 67 89",
      "otherPositions": "Autres fonctions",
      "otherEstablishments": "Autres établissements"
    },
    // More contacts...
  ]
}
```

**Error Responses:**

- 400 Bad Request: Missing required query parameter
  ```json
  {
    "error": "Keyword parameter is required"
  }
  ```

- 500 Internal Server Error: Scraping failed
  ```json
  {
    "error": "An error occurred while scraping",
    "message": "Error details"
  }
  ```

## Deployment

### Deploy to Render

This API can be easily deployed to Render:

1. Create a Render account at [render.com](https://render.com)

2. From the Render dashboard, click "New +" and select "Web Service"

3. Connect your GitHub repository or use the "Public Git repository" option 

4. Configure the service:
   - Name: `scraper-api` (or your preferred name)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the plan that suits your needs (Free tier is available for testing)

5. Add environment variables:
   - Click "Advanced" > "Add Environment Variable"
   - To use cookies from env var instead of file, add:
     - Key: `COOKIES_JSON`
     - Value: The contents of your cookies.json file as a string

6. Click "Create Web Service"

The API will automatically listen on the port provided by Render.

### Deploy to Railway

This API is also designed to be deployed to Railway:

1. Push this code to a GitHub repository
2. Connect the repository to Railway
3. Add the necessary environment variables
4. Deploy!
