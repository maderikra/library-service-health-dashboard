const { pool } = require('../config/database');
const { checkAllSources } = require('./sourceCheckService'); // You'll need to create this
const { generateSummary } = require('../utils/helpers'); // You'll need to create this
const { storeHealthCheck } = require('./databaseService'); // You'll need to create this




async function getLatestHealthData() {
  try {
    console.log('📊 Retrieving latest health data from database...');
    
    // Get all health checks (now only one per source due to upsert)
    const latestChecks = await pool.query(`
      SELECT id, source_name, source_url, source_type, status_code, 
             is_error, response_time, error_message, check_timestamp, updated_at
      FROM health_checks 
      ORDER BY source_name
    `);
    
    console.log(`✅ Found ${latestChecks.rows.length} health check records`);
    console.log('Health check records:', latestChecks.rows.map(r => r.source_name));
    
    const results = [];
    
    for (const check of latestChecks.rows) {
      try {
        // Get components for this health check
        const components = await pool.query(
          `SELECT component_name, component_status, is_error, status_text, error_messages, details
           FROM components 
           WHERE health_check_id = $1
           ORDER BY component_name`,
          [check.id]
        );
        
        const result = {
          name: check.source_name,
          url: check.source_url,
          type: check.source_type,
          status: check.status_code,
          isError: check.is_error,
          responseTime: check.response_time,
          timestamp: check.check_timestamp.toISOString(),
          errorMessage: check.error_message
        };
        
        // Add component data based on source type
        if (components.rows.length > 0) {
          const componentData = {
            totalComponents: components.rows.length,
            errorCount: components.rows.filter(c => c.is_error).length,
            healthyCount: components.rows.filter(c => !c.is_error).length,
            components: components.rows.map(c => {
              try {
                return {
                  name: c.component_name,
                  status: c.component_status,
                  isError: c.is_error,
                  statusText: c.status_text,
                  errorMessages: c.error_messages || [],
                  details: typeof c.details === 'string' ? JSON.parse(c.details) : c.details
                };
              } catch (parseError) {
                console.error(`❌ Error parsing component details for ${c.component_name}:`, parseError.message);
                return {
                  name: c.component_name,
                  status: c.component_status,
                  isError: c.is_error,
                  statusText: c.status_text,
                  errorMessages: c.error_messages || [],
                  details: null
                };
              }
            })
          };
          
          // Assign to appropriate data field based on type
          if (result.type === 'html') {
            result.htmlData = componentData;
          } else if (result.type === 'xml') {
            result.xmlData = componentData;
          } else if (result.type === 'rss') {
            result.rssData = componentData;
          } else if (result.type === 'json') {
            result.jsonData = componentData;
          }
        }
        
        results.push(result);

      } catch (componentError) {
        console.error(`❌ Error processing components for ${check.source_name}:`, componentError.message);
        // Add the result anyway but without component data
        results.push({
          name: check.source_name,
          url: check.source_url,
          type: check.source_type,
          status: check.status_code,
          isError: true,
          responseTime: check.response_time,
          timestamp: check.check_timestamp.toISOString(),
          errorMessage: `Component processing error: ${componentError.message}`
        });
      }
    }
    
    console.log(`✅ Retrieved ${results.length} health check results from database`);
    return results;
  } catch (error) {
    console.error('❌ Error retrieving health data:', error.message);
    throw error;
  }
}

// Background monitoring function
async function performHealthChecks() {
  console.log('🔍 Performing background health checks...');
  
  try {
    const results = await checkAllSources();
    
    // Store/update each result in the database
    for (const result of results) {
      await storeHealthCheck(result);
    }
    
    const summary = generateSummary(results);
    console.log(`✅ Health checks completed: ${summary.healthySources}/${summary.totalSources} sources healthy`);
    
  } catch (error) {
    console.error('❌ Background health check failed:', error.message);
  }
}


module.exports = { getLatestHealthData, performHealthChecks };