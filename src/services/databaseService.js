

const { pool } = require('../config/database');


// Database initialization
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id SERIAL PRIMARY KEY,
        source_name VARCHAR(255) NOT NULL,
        source_url TEXT NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        status_code INTEGER,
        is_error BOOLEAN NOT NULL DEFAULT false,
        response_time INTEGER,
        error_message TEXT,
        check_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS components (
        id SERIAL PRIMARY KEY,
        health_check_id INTEGER REFERENCES health_checks(id) ON DELETE CASCADE,
        component_name VARCHAR(255) NOT NULL,
        component_status VARCHAR(100) NOT NULL,
        is_error BOOLEAN NOT NULL DEFAULT false,
        status_text TEXT,
        error_messages TEXT[],
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Clean up any duplicate health_checks and add unique constraint
    // Delete duplicate records, keeping only the most recent for each source
    await pool.query(`
      DELETE FROM health_checks 
      WHERE id NOT IN (
        SELECT DISTINCT ON (source_name) id
        FROM health_checks 
        ORDER BY source_name, check_timestamp DESC
      )
    `);
    
    // Add unique constraint if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE health_checks 
        ADD CONSTRAINT health_checks_source_name_unique 
        UNIQUE (source_name)
      `);
    } catch (constraintError) {

    }
    
    // Add unique constraint to components if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE components 
        ADD CONSTRAINT components_health_check_component_unique 
        UNIQUE (health_check_id, component_name)
      `);
    } catch (constraintError) {

    }
    
    // Add updated_at column to components if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE components 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (columnError) {

    }
    
    // Add updated_at column to health_checks if it doesn't exist  
    try {
      await pool.query(`
        ALTER TABLE health_checks 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (columnError) {
        
    }
    
    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp 
      ON health_checks(check_timestamp DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_source 
      ON health_checks(source_name, check_timestamp DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_components_health_check 
      ON components(health_check_id)
    `);
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}


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



module.exports = { storeHealthCheck, initializeDatabase };