// Real-world XML configuration examples for your specific Ex Libris system

// IMPORTANT: The URL you provided appears to return HTML/CSS content, not XML service data
// You may need to find the correct API endpoint that returns actual service status XML

// Configuration for Ex Libris service status (when you find the correct XML endpoint)
const exLibrisXmlConfig = {
  name: 'Ex Libris Service Status',
  url: 'https://status.exlibrisgroup.com/api/services.xml', // Replace with actual XML API endpoint
  type: 'xml',
  xmlConfig: {
    servicesPath: 'data.services',
    serviceNameField: 'name',
    outageField: 'outages.outage',
    degradationField: 'outages.degradation', 
    plannedField: 'outages.planned',
    errorThresholds: {
      outage: 0,
      degradation: 0,
      planned: 0
    }
  }
};

// Alternative: If you have a different Ex Libris API endpoint
const alternativeExLibrisConfig = {
  name: 'Ex Libris Status API',
  url: 'https://status.exlibrisgroup.com/status.xml', // Try different endpoint
  type: 'xml',
  xmlConfig: {
    servicesPath: 'services.service', // Different path structure
    serviceNameField: 'serviceName',
    statusField: 'status', // Simple status field
    errorThresholds: {
      // Look for status not equal to "operational"
    }
  }
};

// Fallback: Use the HTML parser instead for the status page
const exLibrisHtmlFallback = {
  name: 'Ex Libris Status Page (HTML)',
  url: 'https://status.exlibrisgroup.com/',
  type: 'html',
  htmlConfig: {
    componentSelector: '.component-inner-container, .service-status, .incident',
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

// Test configuration using a working XML endpoint
const testXmlConfig = {
  name: 'Test XML Service',
  url: 'https://httpbin.org/xml',
  type: 'xml',
  xmlConfig: {
    servicesPath: 'slideshow.slide',
    serviceNameField: 'title',
    typeField: 'type'
    // No error thresholds - will just show as operational
  }
};

// Sample of what the XML should look like for your service status:
const expectedXmlFormat = `
<?xml version="1.0" encoding="UTF-8"?>
<data>
  <result>true</result>
  <services>
    <sys_id>c869f2093b1eaa50966e082c95e45a5e</sys_id>
    <name>Alma CA01</name>
    <cat>Higher Ed Platform CA01</cat>
    <outages>
      <msg>Alma CA01 - no outage</msg>
      <outage>0</outage>
      <degradation>0</degradation>
      <planned>0</planned>
      <exltext>Service is operating normally</exltext>
    </outages>
  </services>
  <services>
    <sys_id>3079f6093b1eaa50966e082c95e45a53</sys_id>
    <name>Primo VE CA01</name>
    <cat>Higher Ed Platform CA01</cat>
    <outages>
      <msg>Primo VE CA01 - no outage</msg>
      <outage>1</outage>
      <degradation>0</degradation>
      <planned>0</planned>
      <exltext>Service experiencing issues</exltext>
    </outages>
  </services>
</data>
`;

// TROUBLESHOOTING TIPS:
// 1. The URL you provided seems to return a web page, not XML data
// 2. Look for API documentation from Ex Libris for the correct XML endpoint
// 3. Try adding .xml or /api/ to the URL path
// 4. Check if you need authentication or special headers
// 5. Consider using the HTML parser instead if no XML API is available

module.exports = {
  exLibrisXmlConfig,
  alternativeExLibrisConfig,
  exLibrisHtmlFallback,
  testXmlConfig,
  expectedXmlFormat
};