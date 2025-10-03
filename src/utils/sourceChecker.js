const axios = require('axios');
const cheerio = require('cheerio');
const { getNestedValue } = require('./helpers');
const xml2js = require('xml2js');



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
      console.log(`🔍 Parsing HTML for ${source.name}...`);
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
      let xmlData;
      
      try {
        // Check if response.data is already parsed JSON or needs parsing
        let responseData;
        if (typeof response.data === 'string') {
          responseData = JSON.parse(response.data);
        } else {
          responseData = response.data;
        }
        
        // Now safely access the nested structure
        if (responseData.result && responseData.result.containers && 
            responseData.result.containers[1] && responseData.result.containers[1].rows &&
            responseData.result.containers[1].rows[0] && responseData.result.containers[1].rows[0].columns &&
            responseData.result.containers[1].rows[0].columns[0] && responseData.result.containers[1].rows[0].columns[0].widgets &&
            responseData.result.containers[1].rows[0].columns[0].widgets[0] && responseData.result.containers[1].rows[0].columns[0].widgets[0].widget &&
            responseData.result.containers[1].rows[0].columns[0].widgets[0].widget.data && 
            responseData.result.containers[1].rows[0].columns[0].widgets[0].widget.data.services) {
          
          const services = responseData.result.containers[1].rows[0].columns[0].widgets[0].widget.data.services;
          console.log(`✅ Found ${services.length} services in XML response`);
          
          // Process services into the expected format
          const servicesArray = services.map(item => ({
            name: item.name,
            status: item.days && item.days[0] ? item.days[0].icon : 'unknown'
          }));
          
          console.log('Services array:', servicesArray);
        }
        
        xmlData = await parseXmlStatus(response.data, source.xmlConfig);
      } catch (parseError) {
        console.error('❌ XML parsing error:', parseError.message);
        xmlData = {
          totalComponents: 1,
          errorCount: 1,
          healthyCount: 0,
          components: [{
            name: 'XML Parse Error',
            status: 'error',
            isError: true,
            errorMessages: [parseError.message],
            rawData: null
          }],
          parseError: parseError.message
        };
      }
      
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
    console.error(`❌ Error checking source ${source.name}:`, error.message);
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

// Function to parse HTML status page
function parseHtmlStatus(html, htmlConfig) {
  try {
    const $ = cheerio.load(html);
    const components = [];
    let totalErrors = 0;
    
    // Handle special Springshare blog logic
    if (htmlConfig.customLogic === 'springshare-blog') {
      return parseSpringshareBloc(html, $, htmlConfig);
    }
    
    // First, try to find any elements with the selector
    const foundElements = $(htmlConfig.componentSelector);
    
    // If no components found with primary selector, try fallback selectors
    if (foundElements.length === 0) {
      
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
    
    console.log(`📈 Processed ${components.length} components, ${totalErrors} with errors`);
    
    const result = {
      totalComponents: components.length,
      errorCount: totalErrors,
      healthyCount: components.length - totalErrors,
      components: components
    };
    
    return result;
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
  console.log(`🔍 Parsing RSS feed for ${url}`);
  
  try {
    const result = await xml2js.parseStringPromise(html);
    const channel = result.rss?.channel?.[0];
    
    if (!channel) {
      console.log('❌ No RSS channel found');
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
        statusText: null,
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

module.exports = { checkSource };