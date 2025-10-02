// Alternative configuration to monitor Ex Libris status using HTML parsing
// Use this if the XML API endpoint is not available

const exLibrisHtmlConfig = {
  name: 'Ex Libris Status Page',
  url: 'https://status.exlibrisgroup.com/',
  type: 'html',
  htmlConfig: {
    componentSelector: '.component-inner-container, .service-item, .status-component',
    statusClassMap: {
      'status-green': 'operational',
      'status-yellow': 'degraded', 
      'status-orange': 'partial_outage',
      'status-red': 'major_outage',
      'operational': 'operational',
      'degraded': 'degraded',
      'outage': 'major_outage'
    },
    errorStatuses: ['degraded', 'partial_outage', 'major_outage']
  }
};

// To use this configuration:
// 1. Replace the XML configuration in index.js with this HTML configuration
// 2. Change the type from 'xml' to 'html'
// 3. Replace xmlConfig with htmlConfig

module.exports = exLibrisHtmlConfig;