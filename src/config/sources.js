
// Configuration for external sources
const EXTERNAL_SOURCES = [

  {
    name: 'Ebsco',
    url: 'https://status.ebsco.com/',
    type: 'html',
    htmlConfig: {
      componentSelector: '.component-inner-container',
      statusClassMap: {
        'status-green': 'operational',
        'status-yellow': 'degraded',
        'status-orange': 'partial_outage',
        'status-red': 'major_outage'
      },
      errorStatuses: ['degraded', 'partial_outage', 'major_outage']
    }
  },
  {
    name: 'ProQuest',
    url: 'https://status.proquest.com/',
    type: 'html',
    htmlConfig: {
      componentSelector: 'tr:has(.component)',  // Table rows containing service components
      statusClassMap: {
        'glyphicon-ok-circle': 'operational',
        'all-clear': 'operational',
        'glyphicon-warning-sign': 'degraded',
        'glyphicon-exclamation-sign': 'partial_outage',
        'glyphicon-remove-circle': 'major_outage',
        'glyphicon-ban-circle': 'major_outage'
      },
      errorStatuses: ['degraded', 'partial_outage', 'major_outage']
    }
  },
  {
    name: 'Springshare',
    url: 'https://lounge.springshare.com/categories/announcements/p1',
    type: 'html',
    htmlConfig: {
      componentSelector: 'noscript li, noscript .discussion-item, noscript .topic, noscript article, li, .discussion-item, .topic, article', // Look in noscript first
      customLogic: 'springshare-blog',
      statusClassMap: {
        'resolved': 'operational',
        'active': 'major_outage'
      },
      errorStatuses: ['major_outage']
    }
  },
  {
    name: 'Gale',
    url: 'https://support.gale.com/technical/status/rss.php',
    type: 'rss',
    description: 'Gale Database Status RSS Feed - Items other than "All Gale Resources Operating Normally" indicate outages'
  },
  {
    name: 'OCLC',
    url: 'https://oclc.service-now.com/api/now/sp/page?portal_id=24fa0f696f6d36005630496aea3ee4a9', // Replace with actual Morrill API URL
    type: 'json',
    jsonConfig: {
      servicesPath: 'result.containers.1.rows.0.columns.0.widgets.0.widget.data.services',
      serviceNameField: 'name',
      statusField: 'status',
      errorStatuses: ['down', 'error', 'outage', 'degraded', 'partial_outage', 'major_outage']
    },
    description: 'OCLC Service Status - JSON API for service monitoring'
  },
  {
    name: 'Ex Libris',
    url: 'https://status.exlibrisgroup.com/api/now/sp/page?portal_id=24ca47791b6fd8d04bd3ca286e4bcb75', // Replace with actual Morrill API URL
    type: 'json',
    jsonConfig: {
      servicesPath: 'result.containers.2.rows.0.columns.0.widgets.0.widget.data.services',
      serviceNameField: 'name',
      statusField: 'status',
      errorStatuses: ['down', 'error', 'outage', 'degraded', 'partial_outage', 'major_outage']
    },
    description: 'OCLC Service Status - JSON API for service monitoring'
  }
];

module.exports = { EXTERNAL_SOURCES };