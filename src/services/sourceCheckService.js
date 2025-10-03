const { EXTERNAL_SOURCES } = require('../config/sources');
const { checkSource } = require('../utils/sourceChecker'); // Move checkSource function here

// Function to check all sources
async function checkAllSources() {
//  console.log('🔍 Checking all external sources...');
  
  const promises = EXTERNAL_SOURCES.map(source => checkSource(source));
  const results = await Promise.all(promises);
  
  return results;
}

module.exports = { checkAllSources };