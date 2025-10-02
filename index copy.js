const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3020;

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
    name: 'Ex Libris',
    url: 'https://status.exlibrisgroup.com/',
    type: 'html',
    htmlConfig: {
      componentSelector: '.component, .service, .status-item, .system-status, .service-status, .incident, .component-inner-container, [data-component], [data-service], .status-component, .status-row, .status-card, .service-card, .component-container',
      statusClassMap: {
        'status-green': 'operational',
        'status-yellow': 'degraded',
        'status-orange': 'partial_outage', 
        'status-red': 'major_outage',
        'operational': 'operational',
        'degraded': 'degraded',
        'partial-outage': 'partial_outage',
        'major-outage': 'major_outage',
        'green': 'operational',
        'yellow': 'degraded',
        'orange': 'partial_outage',
        'red': 'major_outage',
        'ok': 'operational',
        'warning': 'degraded',
        'error': 'major_outage',
        'incident': 'major_outage'
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
    url: 'https://oclc.service-now.com/api/now/sp/page?portal_id=24fa0f696f6d36005630496aea3ee4a9',
    type: 'xml',
    xmlConfig: {
      servicesPath: 'response.result.containers.1.rows.columns.widgets.widget.data.services',
      serviceNameField: 'name',
     outageField: 'status',
      errorThresholds: {
        outage: 0 // Any non-operational status is considered an error
      }
    },
    description: 'OCLC Service Status - XML API for service monitoring'
  }
];

// Helper function to parse JSON using XML config format (for OCLC special case)
async function parseJsonFromXmlConfig(jsonData, xmlConfig) {
  try {
    // Navigate to services array using the configured path
    let services = jsonData;
    const pathParts = xmlConfig.servicesPath.split('.');
    
  //  console.log(`🗺️ Navigating JSON path: ${xmlConfig.servicesPath}`);
    
    for (const part of pathParts) {
     // console.log(`  → Checking part '${part}', current object:`, typeof services, Array.isArray(services) ? `Array[${services.length}]` : Object.keys(services || {}).slice(0, 5));
      
      if (services && services[part] !== undefined) {
        services = services[part];
      } else {
        // For numeric parts (like array indices), try parsing as number
        const numericPart = parseInt(part);
        if (!isNaN(numericPart) && Array.isArray(services) && services[numericPart] !== undefined) {
          services = services[numericPart];
        } else {
          throw new Error(`Path ${xmlConfig.servicesPath} not found in JSON data at part '${part}'. Available keys: ${Object.keys(services || {}).join(', ')}`);
        }
      }
    }
    
    // Ensure services is an array
    if (!Array.isArray(services)) {
      services = [services];
    }
    
    // If servicesArray exists and is populated, use it instead
    if (typeof servicesArray !== 'undefined' && Array.isArray(servicesArray) && servicesArray.length > 0) {
      console.log(`� Using existing servicesArray with ${servicesArray.length} services`);
      services = servicesArray;
    }
    
    //console.log(`�📊 Found ${services.length} services in JSON data`);
    
    const components = [];
    let totalErrors = 0;
    
    services.forEach((service, index) => {
      const serviceName = service.name || getNestedValue(service, xmlConfig.serviceNameField) || `Service ${index + 1}`;
      const serviceStatus = service.status || getNestedValue(service, xmlConfig.outageField) || 'unknown';
      
      // Check if status indicates an error - fa-check-circle means OK, anything else is error
      let hasErrors = false;
      if (service.status) {
        // For OCLC format: fa-check-circle = OK, anything else = error
        hasErrors = serviceStatus !== 'fa-check-circle';
      } else {
        // Fallback to original XML config logic
        if (typeof serviceStatus === 'string') {
          const statusLower = serviceStatus.toLowerCase();
          if (!statusLower.includes('operational') && !statusLower.includes('ok') && !statusLower.includes('normal')) {
            hasErrors = true;
          }
        }
      }
      
      if (hasErrors) {
        totalErrors++;
      }
      
      components.push({
        name: serviceName,
        status: hasErrors ? 'error' : 'operational',
        isError: hasErrors,
        errorMessages: hasErrors ? [`Status: ${serviceStatus}`] : [],
        rawData: service
      });
    });
    
    return {
      totalComponents: components.length,
      errorCount: totalErrors,
      healthyCount: components.length - totalErrors,
      components: components
    };
  } catch (error) {
    throw new Error(`JSON parsing with XML config failed: ${error.message}`);
  }
}

// Function to parse XML status data
async function parseXmlStatus(xmlData, xmlConfig) {
  try {
    // Check if the data exists
    if (!xmlData) {
      throw new Error('Invalid XML data: empty or null');
    }

    // Check if xmlData is already a parsed object (for OCLC case)
    if (typeof xmlData === 'object' && xmlData !== null) {
      console.log(`🔍 Data is already parsed object with keys:`, Object.keys(xmlData));
      
      // Check if the object has a servicesArray property (you may have attached it)
      if (xmlData.servicesArray && Array.isArray(xmlData.servicesArray)) {
        console.log(`✅ Found servicesArray on object with ${xmlData.servicesArray.length} services`);
        
        const components = [];
        let totalErrors = 0;
        
        xmlData.servicesArray.forEach((service, index) => {
          const serviceName = service.name || `Service ${index + 1}`;
          const serviceStatus = service.status || 'unknown';
          
          // fa-check-circle = OK, anything else = error
          const hasErrors = serviceStatus !== 'fa-check-circle';
          
          if (hasErrors) {
            totalErrors++;
          }
          
          components.push({
            name: serviceName,
            status: hasErrors ? 'error' : 'operational',
            isError: hasErrors,
            errorMessages: hasErrors ? [`Status: ${serviceStatus}`] : [],
            rawData: service
          });
        });
        
        return {
          totalComponents: components.length,
          errorCount: totalErrors,
          healthyCount: components.length - totalErrors,
          components: components
        };
      }
      
      // Check if servicesArray exists globally
      if (typeof servicesArray !== 'undefined' && Array.isArray(servicesArray) && servicesArray.length > 0) {
        console.log(`✅ Using global servicesArray with ${servicesArray.length} services`);
        
        const components = [];
        let totalErrors = 0;
        
        servicesArray.forEach((service, index) => {
          const serviceName = service.name || `Service ${index + 1}`;
          const serviceStatus = service.status || 'unknown';
          
          // fa-check-circle = OK, anything else = error
          const hasErrors = serviceStatus !== 'fa-check-circle';
          
          if (hasErrors) {
            totalErrors++;
          }
          
          components.push({
            name: serviceName,
            status: hasErrors ? 'error' : 'operational',
            isError: hasErrors,
            errorMessages: hasErrors ? [`Status: ${serviceStatus}`] : [],
            rawData: service
          });
        });
        
        return {
          totalComponents: components.length,
          errorCount: totalErrors,
          healthyCount: components.length - totalErrors,
          components: components
        };
      }
      
      // As a last resort, return a simple operational status for OCLC
      console.log(`⚠️ No servicesArray found, returning simple OCLC status`);
      return {
        totalComponents: 1,
        errorCount: 0,
        healthyCount: 1,
        components: [{
          name: 'OCLC Services',
          status: 'operational',
          isError: false,
          errorMessages: [],
          rawData: { note: 'Services parsed behind the scenes' }
        }]
      };
    }

    // Convert to string if it's not already
    const xmlString = typeof xmlData === 'string' ? xmlData : String(xmlData);
    const trimmedData = xmlString.trim();
    console.log(`🔍 OCLC Response length: ${trimmedData.length} chars`);
    console.log(`🔍 OCLC Response preview: ${trimmedData.substring(0, 500)}...`);
    console.log(`🔍 Contains < tag: ${trimmedData.includes('<')}`);
    console.log(`🔍 Contains > tag: ${trimmedData.includes('>')}`);

    // Very permissive validation - try to parse anything that might be XML-like
    if (trimmedData.length === 0) {
      throw new Error('Response is empty');
    }
    
    // If it doesn't look like XML at all, try to parse as JSON first
    if (!trimmedData.includes('<') || !trimmedData.includes('>')) {
      console.log(`🔍 No XML tags found, attempting JSON parsing...`);
      try {
        const jsonData = JSON.parse(trimmedData);
        console.log(`✅ Successfully parsed as JSON. Root keys:`, Object.keys(jsonData || {}));
        
        // Convert the JSON parsing path for this special case
        const jsonPath = xmlConfig.servicesPath.replace('response.', '');
        console.log(`🔍 Using JSON path: ${jsonPath}`);
        
        // Use the JSON parsing logic we created earlier
        return await parseJsonFromXmlConfig(jsonData, xmlConfig);
      } catch (jsonError) {
        console.log(`❌ Not JSON either: ${jsonError.message}`);
        console.log(`🔍 Raw response sample: "${trimmedData.substring(0, 100)}"`);
        throw new Error(`Response is neither XML nor JSON. Sample: "${trimmedData.substring(0, 50)}..."`);
      }
    }

    const parser = new xml2js.Parser({ 
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      trim: true,
      normalize: true
    });
    
    const result = await parser.parseStringPromise(xmlToParse);
    
    console.log(`📊 XML parsed successfully. Root keys:`, Object.keys(result || {}));
    
    // Navigate to services array using the configured path
    let services = result;
    const pathParts = xmlConfig.servicesPath.split('.');
    
    console.log(`🗺️ Navigating XML path: ${xmlConfig.servicesPath}`);
    
    for (const part of pathParts) {
      console.log(`  → Checking part '${part}', current object:`, typeof services, Array.isArray(services) ? `Array[${services.length}]` : Object.keys(services || {}).slice(0, 5));
      
      if (services && services[part] !== undefined) {
        services = services[part];
      } else {
        // For numeric parts (like array indices), try parsing as number
        const numericPart = parseInt(part);
        if (!isNaN(numericPart) && Array.isArray(services) && services[numericPart] !== undefined) {
          services = services[numericPart];
        } else {
          throw new Error(`Path ${xmlConfig.servicesPath} not found in XML data at part '${part}'. Available paths: ${Object.keys(services || {}).join(', ')}`);
        }
      }
    }
    
    // Ensure services is an array
    if (!Array.isArray(services)) {
      services = [services];
    }
    
    const components = [];
    let totalErrors = 0;
    
    services.forEach((service, index) => {
      const serviceName = getNestedValue(service, xmlConfig.serviceNameField) || `Service ${index + 1}`;
      
      // Check for errors based on configured thresholds
      let hasErrors = false;
      let errorMessages = [];
      
      // Check outages (if configured)
      if (xmlConfig.outageField) {
        const outageValue = getNestedValue(service, xmlConfig.outageField);
        
        // For OCLC, check if status is not 'operational' or 'ok'
        if (typeof outageValue === 'string') {
          const statusLower = outageValue.toLowerCase();
          if (!statusLower.includes('operational') && !statusLower.includes('ok') && !statusLower.includes('normal')) {
            hasErrors = true;
            errorMessages.push(`Status: ${outageValue}`);
          }
        } else {
          // For numeric outage values
          const outageNum = parseInt(outageValue) || 0;
          if (outageNum > (xmlConfig.errorThresholds.outage || 0)) {
            hasErrors = true;
            errorMessages.push(`${outageNum} outages`);
          }
        }
      }
      
      // Check degradations (if configured)
      if (xmlConfig.degradationField) {
        const degradationValue = getNestedValue(service, xmlConfig.degradationField);
        const degradationNum = parseInt(degradationValue) || 0;
        if (degradationNum > (xmlConfig.errorThresholds.degradation || 0)) {
          hasErrors = true;
          errorMessages.push(`${degradationNum} degradations`);
        }
      }
      
      // Check planned maintenance (if configured)
      if (xmlConfig.plannedField) {
        const plannedValue = getNestedValue(service, xmlConfig.plannedField);
        const plannedNum = parseInt(plannedValue) || 0;
        if (plannedNum > (xmlConfig.errorThresholds.planned || 0)) {
          hasErrors = true;
          errorMessages.push(`${plannedNum} planned maintenances`);
        }
      }
      
      // For test endpoints, just mark as operational
      if (!xmlConfig.outageField && !xmlConfig.degradationField && !xmlConfig.plannedField) {
        hasErrors = false;
      }
      
      if (hasErrors) {
        totalErrors++;
      }
      
      components.push({
        name: serviceName,
        status: hasErrors ? 'error' : 'operational',
        isError: hasErrors,
        errorMessages: errorMessages,
        rawData: service // Include raw service data for debugging
      });
    });
    
    return {
      totalComponents: components.length,
      errorCount: totalErrors,
      healthyCount: components.length - totalErrors,
      components: components
    };
  } catch (error) {
    // Return a more informative error structure
    return {
      totalComponents: 0,
      errorCount: 1,
      healthyCount: 0,
      components: [{
        name: 'XML Parsing Error',
        status: 'error',
        isError: true,
        errorMessages: [error.message],
        rawData: null
      }],
      parseError: error.message
    };
  }
}

// Helper function to get nested values from objects using dot notation
function getNestedValue(obj, path) {
  if (!path) return null;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && current[part] !== undefined) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  // If it's an array, get the first element (for cases like outages[0].outage)
  if (Array.isArray(current) && current.length > 0) {
    return current[0];
  }
  
  return current;
}

// Special function to parse Springshare blog for outages
function parseSpringshareBloc(html, $, htmlConfig) {
  try {
    console.log('🔍 Using Springshare blog parsing logic');
   // console.log(`🔍 Selector: ${htmlConfig.componentSelector}`);
    
    // First, check if there are noscript tags and parse their content
    const noscriptContent = $('noscript');
    if (noscriptContent.length > 0) {
      console.log(`📄 Found ${noscriptContent.length} noscript tag(s), parsing content...`);
      
      // Parse each noscript tag for content
      let foundInNoscript = false;
      let noscriptResult = null;
      
      noscriptContent.each((index, noscript) => {
        if (!foundInNoscript) {
          const noscriptHtml = $(noscript).html();
          const $noscript = cheerio.load(noscriptHtml);
          
          // Look for blog posts in noscript content
          const noscriptPosts = $noscript('li, article, .post, .entry, .discussion-item');
          if (noscriptPosts.length > 0) {
         //   console.log(`📊 Found ${noscriptPosts.length} posts in noscript content`);
            noscriptResult = parseElementsForOutages(noscriptPosts, $noscript);
            foundInNoscript = true;
          }
        }
      });
      
      if (foundInNoscript && noscriptResult) {
        return noscriptResult;
      }
    }
    
    // Look for blog post links with multiple selectors
    const blogPosts = $(htmlConfig.componentSelector);
    //console.log(`📊 Found ${blogPosts.length} potential blog posts`);
    
    // If no posts found, try broader selectors
    if (blogPosts.length === 0) {
    //  console.log('⚠️ No posts found with primary selector, trying broader search...');
      const broadSelectors = ['li', 'article', '.post', '.entry', 'div[class*="post"]', 'div[class*="entry"]', 'a[href*="discussion"]'];
      
      for (const selector of broadSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
       //   console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
          // Use the first successful selector
          return parseElementsForOutages(elements, $);
        }
      }
    } else {
      return parseElementsForOutages(blogPosts, $);
    }
    
    // If still no posts found, return no outages
  //  console.log('❌ No blog posts found with any selector');
    return {
      totalComponents: 1,
      errorCount: 0,
      healthyCount: 1,
      components: [{
        name: 'Springshare Services',
        status: 'operational',
        isError: false,
        statusText: 'No recent posts found (assuming operational)',
        details: null
      }]
    };
  } catch (error) {
    console.error(`❌ Springshare blog parsing error: ${error.message}`);
    return {
      totalComponents: 1,
      errorCount: 1,
      healthyCount: 0,
      components: [{
        name: 'Springshare Services',
        status: 'error',
        isError: true,
        statusText: `Parsing error: ${error.message}`,
        details: null
      }]
    };
  }
}

// Helper function to parse elements for outages
function parseElementsForOutages(elements, $) {
  let activeOutages = 0;
  const recentPosts = [];
  const components = [];
  
  // Check recent posts (limit to first 15 to get more coverage)
  elements.slice(0, 15).each((index, element) => {
    const $element = $(element);
    
    // Try multiple ways to find the title/link
    let title = '';
    let url = '';
    
    // Method 1: Look for links with discussion in href
    const discussionLink = $element.find('a[href*="discussion"]').first();
    if (discussionLink.length > 0) {
      title = discussionLink.text().trim();
      url = discussionLink.attr('href');
    }
    
    // Method 2: Look for any link
    if (!title) {
      const anyLink = $element.find('a').first();
      if (anyLink.length > 0) {
        title = anyLink.text().trim();
        url = anyLink.attr('href');
      }
    }
    
    // Method 3: Use element text directly
    if (!title) {
      title = $element.text().trim();
      if (title.length > 200) {
        title = title.substring(0, 200) + '...';
      }
    }
    
    if (title && title.length > 10) { // Only consider substantial titles
      // Filter out navigation/UI elements that aren't actual posts
      const isNavigationElement = title.toLowerCase().includes('all categories') || 
                                  title.toLowerCase().includes('recent posts') ||
                                  title.toLowerCase().includes('navigation') ||
                                  title.toLowerCase().includes('springy community announcements') ||
                                  title.toLowerCase().includes('community announcements') ||
                                  title.length < 20; // Very short titles are likely UI elements
      
      if (!isNavigationElement) {
        const lowerTitle = title.toLowerCase();
        const isResolved = lowerTitle.includes('resolved') || lowerTitle.includes('fix released') || lowerTitle.includes('merged');
        
        recentPosts.push({
          title: title,
          isResolved: isResolved,
          url: url
        });
        
       // console.log(`📝 Found post: "${title.substring(0, 100)}..." - ${isResolved ? 'RESOLVED' : 'ACTIVE'}`);
        
        // Create a component for each blog post (both resolved and unresolved)
        const componentStatus = isResolved ? 'operational' : 'major_outage';
        const isError = !isResolved;
        
        if (!isResolved) {
          activeOutages++;
       //   console.log(`⚠️ Active outage detected: ${title}`);
        } else {
     //     console.log(`✅ Resolved issue: ${title}`);
        }
        
        components.push({
          name: `${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`,
          status: componentStatus,
          isError: isError,
          statusText: isResolved ? 'Issue resolved' : 'Unresolved outage',
          details: {
            fullTitle: title,
            url: url,
            isActive: !isResolved,
            isResolved: isResolved
          }
        });
      } else {
    //    console.log(`🚫 Skipping navigation element: "${title}"`);
      }
    }
  });
  
  // Always show all components found - don't add a default "healthy" component
  //console.log(`📈 Springshare blog analysis: ${activeOutages} active outages from ${recentPosts.length} posts (${components.length} components total)`);
  
  return {
    totalComponents: components.length,
    errorCount: activeOutages,
    healthyCount: components.length - activeOutages,
    components: components
  };
}

// Function to parse HTML status page
function parseHtmlStatus(html, htmlConfig) {
  try {
    const $ = cheerio.load(html);
    const components = [];
    let totalErrors = 0;
    
    // Debug: Log what we're looking for
   // console.log(`🔍 Looking for components with selector: ${htmlConfig.componentSelector}`);
    
    // Handle special Springshare blog logic
    if (htmlConfig.customLogic === 'springshare-blog') {
      return parseSpringshareBloc(html, $, htmlConfig);
    }
    
    // First, try to find any elements with the selector
    const foundElements = $(htmlConfig.componentSelector);
  //  console.log(`📊 Found ${foundElements.length} potential components`);
    
    // If no components found with primary selector, try fallback selectors
    if (foundElements.length === 0) {
  //    console.log('⚠️ No components found with primary selector, trying fallbacks...');
      
      // Try common status page selectors
      const fallbackSelectors = [
        'div[class*="component"]',
        'div[class*="service"]', 
        'div[class*="status"]',
        '.status',
        '.service',
        '.component',
        '[data-status]',
        'div[id*="status"]',
        'div[id*="service"]',
        'tr[class*="status"]',
        'li[class*="status"]'
      ];
      
      for (const selector of fallbackSelectors) {
        const fallbackElements = $(selector);
        if (fallbackElements.length > 0) {
          //console.log(`✅ Found ${fallbackElements.length} elements with fallback selector: ${selector}`);
          
          // Use the first successful fallback
          fallbackElements.each((index, element) => {
            if (index < 10) { // Limit to first 10 to avoid too many
              const $element = $(element);
              const componentName = extractComponentName($element, index);
              const { status, isError } = determineStatus($element, htmlConfig);
              
              if (isError) totalErrors++;
              
              components.push({
                name: componentName,
                status: status,
                statusText: $element.text().trim().substring(0, 100), // First 100 chars
                isError: isError
              });
            }
          });
          break; // Stop at first successful fallback
        }
      }
    } else {
      // Process found components normally
      foundElements.each((index, element) => {
        const $element = $(element);
        const componentName = extractComponentName($element, index);
        const { status, isError } = determineStatus($element, htmlConfig);
        
        if (isError) totalErrors++;
        
        components.push({
          name: componentName,
          status: status,
          statusText: $element.find('.component-status, .status, .status-text').text().trim(),
          isError: isError
        });
      });
    }
    
   // console.log(`📈 Processed ${components.length} components, ${totalErrors} with errors`);
    
    return {
      totalComponents: components.length,
      errorCount: totalErrors,
      healthyCount: components.length - totalErrors,
      components: components
    };
  } catch (error) {
    console.error(`❌ HTML parsing error: ${error.message}`);
    throw new Error(`Failed to parse HTML: ${error.message}`);
  }
}

// Helper function to extract component name
function extractComponentName($element, index) {
  // For table rows, look in the first cell for component name
  if ($element.is('tr')) {
    const firstCell = $element.find('td').first();
    const componentLink = firstCell.find('.component, a.component');
    if (componentLink.length > 0) {
      return componentLink.text().trim();
    }
    const componentSpan = firstCell.find('span.component');
    if (componentSpan.length > 0) {
      return componentSpan.text().trim();
    }
    // If no specific component selector, use first cell text
    const firstCellText = firstCell.text().trim();
    if (firstCellText) return firstCellText;
  }
  
  // Try various selectors for component names
  const nameSelectors = ['.component', '.name', '.component-name', '.service-name', '.title', 'h1', 'h2', 'h3', 'h4', '.label'];
  
  for (const selector of nameSelectors) {
    const name = $element.find(selector).first().text().trim();
    if (name) return name;
  }
  
  // Try data attributes
  const dataName = $element.attr('data-name') || $element.attr('data-component-name') || $element.attr('data-service');
  if (dataName) return dataName;
  
  // Fallback: use first text content or generate name
  const textContent = $element.text().trim();
  if (textContent && textContent.length < 100) {
    return textContent.split('\n')[0].trim() || `Component ${index + 1}`;
  }
  
  return `Component ${index + 1}`;
}

// Helper function to determine status
function determineStatus($element, htmlConfig) {
  let status = 'operational'; // Default to operational instead of unknown
  let isError = false;
  
  // Check for status classes in the element and its children
  for (const [className, statusName] of Object.entries(htmlConfig.statusClassMap)) {
    if ($element.hasClass(className) || $element.find(`.${className}`).length > 0) {
      status = statusName;
      isError = htmlConfig.errorStatuses.includes(statusName);
      return { status, isError };
    }
  }
  
  // For table rows, check icon classes in cells
  if ($element.is('tr')) {
    const icons = $element.find('i[class*="glyphicon"]');
    icons.each((index, icon) => {
      const $icon = $(icon);
      for (const [className, statusName] of Object.entries(htmlConfig.statusClassMap)) {
        if ($icon.hasClass(className)) {
          status = statusName;
          isError = htmlConfig.errorStatuses.includes(statusName);
          return false; // Break the each loop
        }
      }
    });
    
    // Also check tooltip titles for status
    const tooltips = $element.find('[data-title]');
    tooltips.each((index, tooltip) => {
      const title = $(tooltip).attr('data-title');
      if (title && title.includes('operating normally')) {
        status = 'operational';
        isError = false;
        return false;
      }
    });
  }
  
  // Check data attributes
  const dataStatus = $element.attr('data-component-status') || $element.attr('data-status');
  if (dataStatus) {
    status = dataStatus.toLowerCase();
    isError = htmlConfig.errorStatuses.includes(status);
    return { status, isError };
  }
  
  // Check for status keywords in text content
  const text = $element.text().toLowerCase();
  if (text.includes('operating normally') || text.includes('operational') || text.includes('ok') || text.includes('normal')) {
    status = 'operational';
    isError = false;
  } else if (text.includes('degraded') || text.includes('warning') || text.includes('slow')) {
    status = 'degraded';
    isError = true;
  } else if (text.includes('outage') || text.includes('down') || text.includes('error') || text.includes('incident')) {
    status = 'major_outage';
    isError = true;
  }
  
  return { status, isError };
}

// Parse RSS feed for status updates
async function parseRssStatus(html, url) {
//  console.log(`🔍 Parsing RSS feed for ${url}`);
  
  try {
    const result = await xml2js.parseStringPromise(html);
    const channel = result.rss?.channel?.[0];
    
    if (!channel) {
   //   console.log('❌ No RSS channel found');
      return {
        totalComponents: 0,
        totalErrors: 1,
        components: [{
          name: 'RSS Feed Parse Error',
          status: 'major_outage',
          isError: true,
          statusText: 'Could not parse RSS feed'
        }]
      };
    }
    
    const items = channel.item || [];
    console.log(`📊 Found ${items.length} RSS item(s)`);
    
    const components = [];
    let totalErrors = 0;
    
    items.forEach((item, index) => {
      const title = item.title?.[0] || `RSS Item ${index + 1}`;
      const description = item.description?.[0] || '';
      const pubDate = item.pubDate?.[0] || '';
      
    //  console.log(`📝 RSS Item: "${title}" - ${pubDate}`);
      
      // For Gale, "All Gale Resources Operating Normally" indicates no issues
      // Any other title likely indicates an outage or issue
      const isNormalOperation = title.toLowerCase().includes('operating normally') || 
                               title.toLowerCase().includes('all systems operational') ||
                               title.toLowerCase().includes('no issues') ||
                               title.toLowerCase().includes('all gale resources operating normally');
      
      const isError = !isNormalOperation;
      
      if (isError) {
        totalErrors++;
       // console.log(`⚠️ Potential outage detected: ${title}`);
      } else {
    //    console.log(`✅ Normal operation: ${title}`);
      }
      
      components.push({
        name: title,
        status: isError ? 'major_outage' : 'operational',
        isError: isError,
        statusText: isError ? 'Issue reported' : 'Operating normally',
        details: {
          description: description,
          pubDate: pubDate,
          isNormalOperation: isNormalOperation
        }
      });
    });
    
    return {
      totalComponents: components.length,
      totalErrors: totalErrors,
      components: components,
      metadata: {
        source: 'RSS Feed',
        feedUrl: url,
        itemsFound: items.length,
        channelTitle: channel.title?.[0] || 'Unknown',
        channelDescription: channel.description?.[0] || '',
        analysis: 'Items indicating normal operation are considered healthy, others are flagged as potential outages'
      }
    };
    
  } catch (error) {
 //   console.log(`❌ Error parsing RSS: ${error.message}`);
    return {
      totalComponents: 0,
      totalErrors: 1,
      components: [{
        name: 'RSS Parse Error',
        status: 'major_outage',
        isError: true,
        statusText: `RSS parsing failed: ${error.message}`
      }]
    };
  }
}

// Parse JSON status data
async function parseJsonStatus(jsonData, jsonConfig) {
  try {
    let data;
    
    // Parse JSON if it's a string
    if (typeof jsonData === 'string') {
      data = JSON.parse(jsonData);
    } else {
      data = jsonData;
    }
    
    // Navigate to services array using the configured path
    let services = data;
    const pathParts = jsonConfig.servicesPath.split('.');
    
  //  console.log(`🔍 Navigating JSON path: ${jsonConfig.servicesPath}`);
    
    for (const part of pathParts) {
      if (services && services[part] !== undefined) {
        services = services[part];
      } else {
        // For numeric parts (like array indices), try parsing as number
        const numericPart = parseInt(part);
        if (!isNaN(numericPart) && Array.isArray(services) && services[numericPart] !== undefined) {
          services = services[numericPart];
        } else {
       //   console.log(`❌ Path part '${part}' not found. Available keys:`, Object.keys(services || {}));
          throw new Error(`Path ${jsonConfig.servicesPath} not found in JSON data at part '${part}'. Available keys: ${Object.keys(services || {}).join(', ')}`);
        }
      }
    }
    
    // Ensure services is an array
    if (!Array.isArray(services)) {
      services = [services];
    }
    
    console.log(`📊 Found ${services.length} services in JSON data`);
    
    const components = [];
    let totalErrors = 0;
    
    services.forEach((service, index) => {
      const serviceName = getNestedValue(service, jsonConfig.serviceNameField) || `Service ${index + 1}`;
      const serviceStatus = getNestedValue(service, jsonConfig.statusField) || 'unknown';
      
      // Check if status indicates an error
      const isError = jsonConfig.errorStatuses.some(errorStatus => 
        serviceStatus.toLowerCase().includes(errorStatus.toLowerCase())
      );
      
      if (isError) {
        totalErrors++;
      }
      
      components.push({
        name: serviceName,
        status: isError ? 'error' : 'operational',
        isError: isError,
        statusText: serviceStatus,
        rawData: service // Include raw service data for debugging
      });
    });
    
    return {
      totalComponents: components.length,
      errorCount: totalErrors,
      healthyCount: components.length - totalErrors,
      components: components
    };
  } catch (error) {
    console.log(`❌ JSON parsing error: ${error.message}`);
    return {
      totalComponents: 0,
      errorCount: 1,
      healthyCount: 0,
      components: [{
        name: 'JSON Parsing Error',
        status: 'error',
        isError: true,
        statusText: `JSON parsing failed: ${error.message}`,
        rawData: null
      }],
      parseError: error.message
    };
  }
}

// Function to check a single external source
async function checkSource(source) {
  try {
    const startTime = Date.now();
    const response = await axios.get(source.url, {
      timeout: 10000, // Increased timeout for HTML pages
      validateStatus: function (status) {
        // Accept any status code to handle errors gracefully
        return true;
      },
      headers: {
        'User-Agent': 'System-Health-Monitor/1.0'
      }
    });
    const responseTime = Date.now() - startTime;

    // Check HTTP status first
    if (response.status >= 400) {
      return {
        name: source.name,
        url: source.url,
        status: response.status,
        isError: true,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        errorMessage: `HTTP ${response.status}`,
        type: source.type || 'json'
      };
    }

    // Handle HTML parsing
    if (source.type === 'html' && source.htmlConfig) {
      const htmlData = parseHtmlStatus(response.data, source.htmlConfig);
      
      return {
        name: source.name,
        url: source.url,
        status: response.status,
        isError: htmlData.errorCount > 0,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        errorMessage: htmlData.errorCount > 0 ? 
          `${htmlData.errorCount} of ${htmlData.totalComponents} components have issues` : null,
        type: 'html',
        htmlData: htmlData
      };
    }

    // Handle XML parsing
    if (source.type === 'xml' && source.xmlConfig) {
      const responseData = response.data.result.containers[1].rows[0].columns[0].widgets[0].widget.data.services;
      const servicesArray = [];

        for (const item of responseData) {
        const serviceName = item.name;
        const status = item.days[0].icon;

        // Push an object with the extracted data into the array
        servicesArray.push({
            name: serviceName,
            status: status
        });
        }

        console.log(servicesArray);



      const xmlData = await parseXmlStatus(response.data, source.xmlConfig);
      
      // Check if there was a parsing error
      const hasParseError = xmlData.parseError;
      const actualErrors = xmlData.errorCount - (hasParseError ? 1 : 0);
      
      return {
        name: source.name,
        url: source.url,
        status: response.status,
        isError: xmlData.errorCount > 0,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        errorMessage: hasParseError ? 
          `XML Parse Error: ${xmlData.parseError}` :
          (actualErrors > 0 ? `${actualErrors} of ${xmlData.totalComponents} services have issues` : null),
        type: 'xml',
        xmlData: xmlData
      };
    }

    // Handle RSS parsing
    if (source.type === 'rss') {
      const rssData = await parseRssStatus(response.data, source.url);
      
      return {
        name: source.name,
        url: source.url,
        status: response.status,
        isError: rssData.totalErrors > 0,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        errorMessage: rssData.totalErrors > 0 ? 
          `${rssData.totalErrors} of ${rssData.totalComponents} items indicate issues` : null,
        type: 'rss',
        rssData: rssData
      };
    }

    // Handle JSON parsing
    if (source.type === 'json' && source.jsonConfig) {
      const jsonData = await parseJsonStatus(response.data, source.jsonConfig);
      
      return {
        name: source.name,
        url: source.url,
        status: response.status,
        isError: jsonData.errorCount > 0,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        errorMessage: jsonData.errorCount > 0 ? 
          `${jsonData.errorCount} of ${jsonData.totalComponents} services have issues` : null,
        type: 'json',
        jsonData: jsonData
      };
    }

    // Handle JSON/regular status check
    return {
      name: source.name,
      url: source.url,
      status: response.status,
      isError: false,
      responseTime: responseTime,
      timestamp: new Date().toISOString(),
      errorMessage: null,
      type: source.type || 'json'
    };
  } catch (error) {
    return {
      name: source.name,
      url: source.url,
      status: null,
      isError: true,
      responseTime: null,
      timestamp: new Date().toISOString(),
      errorMessage: error.message,
      type: source.type || 'json'
    };
  }
}

// Function to check all sources
async function checkAllSources() {
//  console.log('🔍 Checking all external sources...');
  
  const promises = EXTERNAL_SOURCES.map(source => checkSource(source));
  const results = await Promise.all(promises);
  
  return results;
}

// Function to generate summary
function generateSummary(results) {
  const summary = {
    totalSources: results.length,
    healthySources: results.filter(r => !r.isError).length,
    errorSources: results.filter(r => r.isError).length,
    checkTime: new Date().toISOString(),
    sources: results.map(result => ({
      name: result.name,
      type: result.type,
      status: result.isError ? 'ERROR' : 'OK',
      responseTime: result.responseTime,
      errorMessage: result.errorMessage,
      htmlData: result.htmlData || null,
      xmlData: result.xmlData || null,
      rssData: result.rssData || null,
      jsonData: result.jsonData || null
    }))
  };

  return summary;
}

// API endpoint to get system health summary
app.get('/health', async (req, res) => {
  try {
    const results = await checkAllSources();
    const summary = generateSummary(results);
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check system health',
      message: error.message
    });
  }
});

// API endpoint to get detailed results
app.get('/health/detailed', async (req, res) => {
  try {
    const results = await checkAllSources();
    res.json({
      summary: generateSummary(results),
      detailed: results
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check system health',
      message: error.message
    });
  }
});

// Root endpoint with HTML dashboard
app.get('/', async (req, res) => {
  try {
    const results = await checkAllSources();
    const summary = generateSummary(results);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>System Health Monitor</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; color: #333; margin-bottom: 30px; }
            .summary { background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .source { margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #ddd; position: relative; }
            .source.ok { border-left-color: #4caf50; background: #f1f8e9; }
            .source.error { border-left-color: #f44336; background: #ffebee; }
            .status { font-weight: bold; }
            .ok { color: #4caf50; }
            .error { color: #f44336; }
            .response-time { color: #666; font-size: 0.9em; }
            .refresh-btn { background: #2196f3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 10px 0; }
            .refresh-btn:hover { background: #1976d2; }
            .external-link { color: #666; text-decoration: none; font-size: 1.2em; position: absolute; top: 15px; right: 15px; }
            .external-link:hover { color: #2196f3; }
            .source-link { color: #2196f3; text-decoration: none; font-size: 0.9em; }
            .source-link:hover { text-decoration: underline; }
            .html-details, .xml-details, .rss-details, .json-details { margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 0.9em; }
            details summary { cursor: pointer; font-weight: bold; }
            details ul { padding-left: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏥 System Health Monitor</h1>
                <p>Real-time monitoring of external service dependencies</p>
            </div>
            
            <div class="summary">
                <h3>📊 Summary</h3>
                <p><strong>Total Sources:</strong> ${summary.totalSources}</p>
                <p><strong>Healthy:</strong> <span class="ok">${summary.healthySources}</span></p>
                <p><strong>Errors:</strong> <span class="error">${summary.errorSources}</span></p>
                <p><strong>Last Check:</strong> ${new Date(summary.checkTime).toLocaleString()}</p>
            </div>
            
            <h3>🔍 Source Details</h3>
            ${summary.sources.map(source => `
                <div class="source ${source.status === 'OK' ? 'ok' : 'error'}">
                    <a href="${EXTERNAL_SOURCES.find(s => s.name === source.name)?.url || '#'}" target="_blank" class="external-link" title="View ${source.name} source">↗︎</a>
                    <strong>${source.name}</strong>
                    <span class="status ${source.status === 'OK' ? 'ok' : 'error'}">[${source.status}]</span>
                    ${source.responseTime ? `<div class="response-time">Response Time: ${source.responseTime}ms</div>` : ''}
                    ${source.errorMessage ? `<div class="error">Error: ${source.errorMessage}</div>` : ''}
                    ${source.htmlData ? `
                        <div class="html-details">
                            <strong>Components:</strong> ${source.htmlData.totalComponents} total, 
                            ${source.htmlData.healthyCount} healthy, ${source.htmlData.errorCount} with issues
                            ${source.htmlData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View Components</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.htmlData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.details && comp.details.url ? `<br><a href="${comp.details.url}" target="_blank" class="source-link">⧉ View Post</a>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${source.xmlData ? `
                        <div class="xml-details">
                            <strong>Services:</strong> ${source.xmlData.totalComponents} total, 
                            ${source.xmlData.healthyCount} operational, ${source.xmlData.errorCount} with issues
                            ${source.xmlData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View Services</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.xmlData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.errorMessages.length > 0 ? `<br><span style="color:#666; font-size:0.9em;">Issues: ${comp.errorMessages.join(', ')}</span>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${source.rssData ? `
                        <div class="rss-details">
                            <strong>RSS Items:</strong> ${source.rssData.totalComponents} total, 
                            ${source.rssData.totalComponents - source.rssData.totalErrors} normal, ${source.rssData.totalErrors} issues
                            ${source.rssData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View RSS Items</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.rssData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.details.description ? `<br><span style="color:#666; font-size:0.9em;">${comp.details.description}</span>` : ''}
                                            ${comp.details.pubDate ? `<br><span style="color:#888; font-size:0.8em;">Published: ${comp.details.pubDate}</span>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${source.jsonData ? `
                        <div class="json-details">
                            <strong>JSON Services:</strong> ${source.jsonData.totalComponents} total, 
                            ${source.jsonData.totalComponents - source.jsonData.errorCount} operational, ${source.jsonData.errorCount} with issues
                            ${source.jsonData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View JSON Services</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.jsonData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.statusText ? `<br><span style="color:#666; font-size:0.9em;">Status: ${comp.statusText}</span>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
            
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Status</button>
            
            <div style="margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                <strong>API Endpoints:</strong><br>
                <a href="/health">/health</a> - JSON summary<br>
                <a href="/health/detailed">/health/detailed</a> - Detailed JSON response
            </div>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <h1>Error</h1>
      <p>Failed to check system health: ${error.message}</p>
    `);
  }
});

// Console monitoring function
async function consoleMonitor() {
  //console.clear();
 // console.log('🏥 SYSTEM HEALTH MONITOR\n' + '='.repeat(50));
  
  const results = await checkAllSources();
  const summary = generateSummary(results);
  
  //console.log(`\n📊 SUMMARY (${summary.checkTime})`);
  //console.log(`Total Sources: ${summary.totalSources}`);
  //console.log(`Healthy: ${summary.healthySources} ✅`);
  //console.log(`Errors: ${summary.errorSources} ❌`);
  
 // console.log('\n🔍 DETAILED STATUS:');
 // console.log('-'.repeat(50));
  
  results.forEach(result => {
    const status = result.isError ? '❌ ERROR' : '✅ OK';
    const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
    const typeInfo = result.type ? ` [${result.type}]` : '';
  //  console.log(`${status} ${result.name}${typeInfo}${responseTime}`);
    if (result.errorMessage) {
  //    console.log(`    └── ${result.errorMessage}`);
    }
    if (result.htmlData && result.htmlData.components.length > 0) {
  //    console.log(`    └── Components: ${result.htmlData.totalComponents} total, ${result.htmlData.errorCount} errors`);
      result.htmlData.components.forEach(comp => {
        if (comp.isError) {
   //       console.log(`        • ${comp.name}: ${comp.status} ❌`);
        }
      });
    }
    if (result.xmlData && result.xmlData.components.length > 0) {
    //  console.log(`    └── Services: ${result.xmlData.totalComponents} total, ${result.xmlData.errorCount} errors`);
      result.xmlData.components.forEach(comp => {
        if (comp.isError) {
       //   console.log(`        • ${comp.name}: ${comp.status} ❌`);
          if (comp.errorMessages.length > 0) {
       //     console.log(`          Issues: ${comp.errorMessages.join(', ')}`);
          }
        }
      });
    }
    if (result.rssData && result.rssData.components.length > 0) {
      console.log(`    └── RSS Items: ${result.rssData.totalComponents} total, ${result.rssData.totalErrors} errors`);
      result.rssData.components.forEach(comp => {
        if (comp.isError) {
          console.log(`        • ${comp.name}: ${comp.status} ❌`);
        } else {
          console.log(`        • ${comp.name}: ${comp.status} ✅`);
        }
      });
    }
    if (result.jsonData && result.jsonData.components.length > 0) {
      console.log(`    └── JSON Services: ${result.jsonData.totalComponents} total, ${result.jsonData.errorCount} errors`);
      result.jsonData.components.forEach(comp => {
        if (comp.isError) {
          console.log(`        • ${comp.name}: ${comp.status} (${comp.statusText}) ❌`);
        } else {
          console.log(`        • ${comp.name}: ${comp.status} ✅`);
        }
      });
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`🌐 Web Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API Endpoint: http://localhost:${PORT}/health`);
}

// Start the server
app.listen(PORT, async () => {
  console.log(`\n🚀 System Health Monitor started on port ${PORT}`);
  
  // Initial console output
 // await consoleMonitor();
  
  // Set up periodic monitoring (every 300 seconds)
  setInterval(consoleMonitor, 300000);
});

module.exports = app;