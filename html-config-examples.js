// Example HTML configuration for different status page formats

// Configuration for your specific HTML structure
const customHtmlConfig = {
  name: 'Your Custom Status Page',
  url: 'https://your-status-page.com',
  type: 'html',
  htmlConfig: {
    componentSelector: '.component-inner-container', // Main container for each component
    statusClassMap: {
      'status-green': 'operational',    // Green = working fine
      'status-yellow': 'degraded',      // Yellow = some issues
      'status-orange': 'partial_outage', // Orange = partial problems
      'status-red': 'major_outage'      // Red = serious issues
    },
    errorStatuses: ['degraded', 'partial_outage', 'major_outage'] // Which statuses count as errors
  }
};

// Alternative configuration for different HTML structure
const alternativeHtmlConfig = {
  name: 'Alternative Status Page',
  url: 'https://alternative-status.com',
  type: 'html',
  htmlConfig: {
    componentSelector: '.service-status', // Different selector
    statusClassMap: {
      'online': 'operational',
      'warning': 'degraded',
      'offline': 'major_outage'
    },
    errorStatuses: ['degraded', 'major_outage']
  }
};

// Configuration for Atlassian-style status pages
const atlassianStyleConfig = {
  name: 'Atlassian Status Page',
  url: 'https://status.atlassian.com',
  type: 'html',
  htmlConfig: {
    componentSelector: '[data-component-id]',
    statusClassMap: {
      'status-green': 'operational',
      'status-yellow': 'performance_issues',
      'status-orange': 'partial_outage',
      'status-red': 'major_outage'
    },
    errorStatuses: ['performance_issues', 'partial_outage', 'major_outage']
  }
};

module.exports = {
  customHtmlConfig,
  alternativeHtmlConfig,
  atlassianStyleConfig
};