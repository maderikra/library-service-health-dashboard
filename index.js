const express = require('express');
const path = require('path');

const healthRoutes = require('./src/routes/health');
const { performHealthChecks } = require('./src/services/healthCheckService');
const { pool } = require('./src/config/database');
const dashboardRoutes = require('./src/routes/dashboard');


// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3020;

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

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/health', healthRoutes);

app.use('/', dashboardRoutes);


// Start the server
app.listen(PORT, async () => {
  console.log(`\nSystem Health Monitor started on port ${PORT}`);
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Perform initial health check
    await performHealthChecks();
    
    // Set up periodic monitoring every 5 minutes
    setInterval(performHealthChecks, 5 * 60 * 1000);
    
    
  } catch (error) {
    console.error('❌ Failed to start monitoring system:', error.message);
    process.exit(1);
  }
});

module.exports = app;