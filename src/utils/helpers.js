
// Helper function to get nested values from objects using dot notation
function getNestedValue(obj, path) {
  if (!path) return obj;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  
  // If it's an array, get the first element (for cases like outages[0].outage)
  if (Array.isArray(current) && current.length > 0) {
    return current[0];
  }
  
  return current;
}

// Helper function to find all arrays in object that could contain services
function findAllServiceArrays(obj, path = '', arrays = []) {
  if (!obj || typeof obj !== 'object') return arrays;
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (Array.isArray(value)) {
      arrays.push({ path: currentPath, array: value });
    } else if (typeof value === 'object') {
      findAllServiceArrays(value, currentPath, arrays);
    }
  }
  
  return arrays;
}

// Function to generate summary
function generateSummary(results) {
  
  // Find the most recent check time from all results
  const checkTimes = results.map(r => new Date(r.timestamp)).filter(date => !isNaN(date));
  const latestCheckTime = checkTimes.length > 0 ? 
    new Date(Math.max(...checkTimes)).toISOString() : 
    new Date().toISOString();
  
  const summary = {
    totalSources: results.length,
    healthySources: results.filter(r => !r.isError).length,
    errorSources: results.filter(r => r.isError).length,
    checkTime: latestCheckTime, // Use actual database timestamp
    sources: results.map(result => ({
      name: result.name,
      type: result.type,
      status: result.isError ? 'ERROR' : 'OK',
      responseTime: result.responseTime,
      errorMessage: result.errorMessage,
      htmlData: result.htmlData || null,
      xmlData: result.xmlData || null,
      rssData: result.rssData || null,
      jsonData: result.jsonData || null,
      lastUpdated: result.timestamp // Include individual timestamps
    }))
  };

  console.log(`📊 Summary: ${summary.totalSources} sources, ${summary.healthySources} healthy, ${summary.errorSources} errors`);
  console.log(`🕐 Latest check time: ${latestCheckTime}`);
  return summary;
}

module.exports = { getNestedValue, findAllServiceArrays, generateSummary };