

const { pool } = require('../config/database');

// Database helper functions
async function storeHealthCheck(sourceResult) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    //console.log(`Storing/updating health check for ${sourceResult.name}`);

    
    // Upsert main health check record (update if exists, insert if not)
    const healthCheckResult = await client.query(
      `INSERT INTO health_checks 
       (source_name, source_url, source_type, status_code, is_error, response_time, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (source_name) 
       DO UPDATE SET 
         source_url = EXCLUDED.source_url,
         source_type = EXCLUDED.source_type,
         status_code = EXCLUDED.status_code,
         is_error = EXCLUDED.is_error,
         response_time = EXCLUDED.response_time,
         error_message = EXCLUDED.error_message,
         check_timestamp = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        sourceResult.name,
        sourceResult.url,
        sourceResult.type,
        sourceResult.status,
        sourceResult.isError,
        sourceResult.responseTime,
        sourceResult.errorMessage
      ]
    );
    
    const healthCheckId = healthCheckResult.rows[0].id;
    
    // Delete existing components for this health check to avoid stale data
    await client.query(
      'DELETE FROM components WHERE health_check_id = $1',
      [healthCheckId]
    );
    
    // Insert new component details if available
    const componentData = sourceResult.htmlData || sourceResult.xmlData || sourceResult.rssData || sourceResult.jsonData;
    
    if (componentData && componentData.components) {
    //  console.log(`Storing ${componentData.components.length} components for ${sourceResult.name}`);
      
      for (const component of componentData.components) {
        await client.query(
          `INSERT INTO components 
           (health_check_id, component_name, component_status, is_error, status_text, error_messages, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            healthCheckId,
            component.name,
            component.status,
            component.isError,
            component.statusText || '',
            component.errorMessages || [],
            JSON.stringify(component.details || {})
          ]
        );
      }
    } else {
      console.log(`⚠️ No components found for ${sourceResult.name} - no component data to store`);
    }
    
    await client.query('COMMIT');
    return healthCheckId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Error storing health check for ${sourceResult.name}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}



module.exports = { storeHealthCheck };