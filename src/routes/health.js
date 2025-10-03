const express = require('express');
const router = express.Router();

const { getLatestHealthData, performHealthChecks } = require('../services/healthCheckService');
const { generateSummary } = require('../utils/helpers');


// API endpoint to get system health summary (from database)
router.get('/', async (req, res) => {
  try {
    const results = await getLatestHealthData();
    const summary = generateSummary(results);
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system health from database',
      message: error.message
    });
  }
});

// API endpoint to force immediate health check (stores in database)
router.post('/check', async (req, res) => {
  try {
    await performHealthChecks();
    const results = await getLatestHealthData();
    const summary = generateSummary(results);
    
    res.json({
      message: 'Health check completed and stored in database',
      summary: summary
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to perform health check',
      message: error.message
    });
  }
});


module.exports = router;