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

// Get the base path from environment variable or default to root
const BASE_PATH = process.env.BASE_PATH || '';

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Serve static files with the base path
if (BASE_PATH) {
  app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Make BASE_PATH available to all views
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  next();
});

// set routes
app.use(BASE_PATH + '/health', healthRoutes);
app.use(BASE_PATH, dashboardRoutes);


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