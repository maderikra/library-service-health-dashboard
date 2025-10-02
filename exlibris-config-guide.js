// Ex Libris Status Page HTML Configuration Guide
// Use this to customize the parsing for better accuracy

// Current configuration (working)
const currentConfig = {
  name: 'Ex Libris Service Status',
  url: 'https://status.exlibrisgroup.com/',
  type: 'html',
  htmlConfig: {
    componentSelector: '.component-inner-container, .service-status, .status-component, .incident-component',
    statusClassMap: {
      'status-green': 'operational',
      'status-yellow': 'degraded',
      'status-orange': 'partial_outage', 
      'status-red': 'major_outage',
      'operational': 'operational',
      'degraded': 'degraded',
      'partial-outage': 'partial_outage',
      'major-outage': 'major_outage'
    },
    errorStatuses: ['degraded', 'partial_outage', 'major_outage']
  }
};

// If you want to customize further, you can inspect the Ex Libris status page
// and update these selectors:

const customizedConfig = {
  name: 'Ex Libris Service Status (Customized)',
  url: 'https://status.exlibrisgroup.com/',
  type: 'html',
  htmlConfig: {
    // Add more specific selectors if you inspect the page HTML:
    componentSelector: [
      '.component-inner-container',  // Standard status page components
      '.service-item',               // Individual service items
      '.incident-container',         // Incident reports
      '.maintenance-item',           // Maintenance notices
      '[data-component-id]'          // Components with data attributes
    ].join(', '),
    
    statusClassMap: {
      // Green statuses (working)
      'status-green': 'operational',
      'component-status-operational': 'operational',
      'operational': 'operational',
      
      // Yellow statuses (performance issues)
      'status-yellow': 'degraded',
      'component-status-degraded': 'degraded',
      'degraded': 'degraded',
      'performance-issues': 'degraded',
      
      // Orange statuses (partial outage)
      'status-orange': 'partial_outage',
      'component-status-partial': 'partial_outage',
      'partial-outage': 'partial_outage',
      
      // Red statuses (major outage)
      'status-red': 'major_outage',
      'component-status-outage': 'major_outage',
      'major-outage': 'major_outage',
      'outage': 'major_outage'
    },
    
    errorStatuses: ['degraded', 'partial_outage', 'major_outage']
  }
};

// DEBUGGING TIPS:
// 1. Open https://status.exlibrisgroup.com/ in your browser
// 2. Right-click and "Inspect Element" on service components
// 3. Look for CSS classes that indicate status (green, yellow, red, etc.)
// 4. Update the componentSelector and statusClassMap accordingly
// 5. Test the changes and monitor the console output

module.exports = {
  currentConfig,
  customizedConfig
};