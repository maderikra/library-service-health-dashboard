// XML Configuration Examples for System Health Monitor

// Configuration for your specific XML format with services and outages
const yourXmlConfig = {
  name: 'Your Service Status XML API',
  url: 'https://your-api-endpoint.com/status.xml',
  type: 'xml',
  xmlConfig: {
    servicesPath: 'data.services',       // Path to the services array in XML
    serviceNameField: 'name',            // Field containing service name (e.g., "Alma CA01")
    outageField: 'outages.outage',       // Field for outage count (0 = no outage)
    degradationField: 'outages.degradation', // Field for degradation count
    plannedField: 'outages.planned',     // Field for planned maintenance count
    errorThresholds: {
      outage: 0,        // Error if outage count > 0
      degradation: 0,   // Error if degradation count > 0
      planned: 0        // Error if planned maintenance count > 0 (set to -1 to ignore)
    }
  }
};

// Alternative configuration for different XML structure
const alternativeXmlConfig = {
  name: 'Alternative XML Status API',
  url: 'https://alternative-api.com/status.xml',
  type: 'xml',
  xmlConfig: {
    servicesPath: 'root.systems.system',
    serviceNameField: 'serviceName',
    outageField: 'status.errors',
    degradationField: 'status.warnings',
    plannedField: 'maintenance.active',
    errorThresholds: {
      outage: 0,
      degradation: 2,    // Allow up to 2 degradations before marking as error
      planned: -1        // Ignore planned maintenance (-1 means don't check)
    }
  }
};

// Configuration for simple status XML
const simpleXmlConfig = {
  name: 'Simple XML Status',
  url: 'https://simple-api.com/status.xml',
  type: 'xml',
  xmlConfig: {
    servicesPath: 'status.services',
    serviceNameField: 'name',
    // You can also use a simple boolean field
    statusField: 'operational',          // If this field exists, check if it's 'true'
    errorThresholds: {
      // For boolean status, you can check the result field from your XML
      result: false  // Error if result field is false
    }
  }
};

// Sample XML data structure that matches your format:
const sampleXmlData = `
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

// How the XML parser will interpret your data:
// 1. Navigate to 'data.services' to find the services array
// 2. For each service, extract the 'name' field
// 3. Check the 'outages.outage', 'outages.degradation', and 'outages.planned' values
// 4. If any of these exceed the thresholds (0), mark the service as having errors
// 5. Count total services vs. services with errors

module.exports = {
  yourXmlConfig,
  alternativeXmlConfig,
  simpleXmlConfig,
  sampleXmlData
};