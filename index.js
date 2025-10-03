const express = require('express');
const path = require('path');

const healthRoutes = require('./src/routes/health');
const dashboardRoutes = require('./src/routes/dashboard');

const { performHealthChecks } = require('./src/services/healthCheckService');
const { initializeDatabase } = require('./src/services/databaseService');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3020;

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(express.static(path.join(__dirname, 'public')));

// set routes
app.use('/health', healthRoutes);
app.use('/', dashboardRoutes);


// Start the server
app.listen(PORT, async () => {
  console.log(`System Health Monitor started on port ${PORT}`);
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Perform initial health check
    await performHealthChecks();
    
    // Set up periodic monitoring every 5 minutes
    setInterval(performHealthChecks, 5 * 60 * 1000);
    
    
  } catch (error) {
    console.error('Failed to start monitoring system:', error.message);
    process.exit(1);
  }
});

module.exports = app;