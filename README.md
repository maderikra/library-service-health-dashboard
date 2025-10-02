# System Health Monitor

A Node.js application that monitors the health of external services and provides real-time status updates.

## Features

- **Multiple Monitoring Sources**: The app checks several external APIs, HTML status pages, and XML endpoints
- **HTML Status Page Parsing**: Parse HTML status pages to extract component status information
- **XML Data Parsing**: Parse XML responses to extract service status and error information
- **Three Ways to View Data**:
  - **Web Dashboard** (`http://localhost:3000`) - Beautiful HTML interface
  - **JSON API** (`/health`) - Summary endpoint
  - **Console Output** - Real-time terminal updates every 30 seconds
- **Error Tracking**: 
  - Counts healthy vs error sources
  - Shows response times
  - Displays error messages
  - Tracks HTTP status codes
  - Parses individual component statuses from HTML pages
- **Real-time Updates**:
  - Auto-refreshes console every 30 seconds
  - Web dashboard with manual refresh
  - Timeout handling for unresponsive services

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Start the Application
```bash
npm start
```

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Access the Dashboard
- **Web Interface**: http://localhost:3000
- **API Summary**: http://localhost:3000/health
- **Detailed API**: http://localhost:3000/health/detailed

## API Endpoints

### GET /health
Returns a summary of system health:
```json
{
  "totalSources": 4,
  "healthySources": 3,
  "errorSources": 1,
  "checkTime": "2025-09-29T10:30:00.000Z",
  "sources": [
    {
      "name": "JSONPlaceholder API",
      "status": "OK",
      "responseTime": 245,
      "errorMessage": null
    }
  ]
}
```

### GET /health/detailed
Returns detailed information including full response data.

## Configuration

You can modify the `EXTERNAL_SOURCES` array in `index.js` to monitor different services:

### JSON/API Endpoints
```javascript
{
  name: 'Your API',
  url: 'https://your-api.com/health',
  type: 'json',
  errorField: null // Will check HTTP status
}
```

### XML Data Endpoints
```javascript
{
  name: 'Your XML Status API',
  url: 'https://your-api.com/status.xml',
  type: 'xml',
  xmlConfig: {
    servicesPath: 'data.services',           // Path to services in XML
    serviceNameField: 'name',                // Service name field
    outageField: 'outages.outage',          // Outage count field
    degradationField: 'outages.degradation', // Degradation count field
    plannedField: 'outages.planned',         // Planned maintenance field
    errorThresholds: {
      outage: 0,        // Error if outage count > 0
      degradation: 0,   // Error if degradation count > 0
      planned: 0        // Error if planned maintenance > 0
    }
  }
}
```
```javascript
{
  name: 'Your Status Page',
  url: 'https://your-status-page.com',
  type: 'html',
  htmlConfig: {
    componentSelector: '.component-inner-container', // CSS selector for components
    statusClassMap: {
      'status-green': 'operational',    // CSS class to status mapping
      'status-yellow': 'degraded',
      'status-red': 'major_outage'
    },
    errorStatuses: ['degraded', 'major_outage'] // Which statuses count as errors
  }
}
```

### XML Parsing Details
The XML parser:
- **Service extraction**: Navigates to the specified path to find service arrays
- **Field mapping**: Extracts service names and status counts from specified fields
- **Error detection**: Compares numerical values against thresholds to determine errors
- **Flexible configuration**: Supports nested field paths using dot notation (e.g., 'outages.outage')

## Default Monitored Services

- JSONPlaceholder API (test API) - JSON
- GitHub API - JSON
- HTTPBin Status (200 response) - JSON
- Mock Error Service (intentionally returns 500 for testing) - JSON
- EBSCO Status Page - HTML parsing example
- Service Status XML API - XML parsing example

## Customization

- **Port**: Set the `PORT` environment variable or modify the default in `index.js`
- **Check Interval**: Modify the interval in the `setInterval` call (default: 30 seconds)
- **Timeout**: Adjust the axios timeout value (default: 5 seconds)
- **Sources**: Add or remove services in the `EXTERNAL_SOURCES` array

## Example Output

```
🏥 SYSTEM HEALTH MONITOR
==================================================

📊 SUMMARY (2025-09-29T10:30:00.000Z)
Total Sources: 4
Healthy: 3 ✅
Errors: 1 ❌

🔍 DETAILED STATUS:
--------------------------------------------------
✅ OK JSONPlaceholder API (245ms)
✅ OK GitHub API (123ms)
✅ OK HTTPBin Status (89ms)
❌ ERROR Mock Error Service (156ms)
    └── HTTP 500

==================================================
🌐 Web Dashboard: http://localhost:3000
📡 API Endpoint: http://localhost:3000/health
```

## Dependencies

- **express**: Web server framework
- **axios**: HTTP client for making requests to external services
- **cheerio**: Server-side HTML parsing for status page analysis
- **xml2js**: XML parsing library for analyzing XML status data

## License

MIT License