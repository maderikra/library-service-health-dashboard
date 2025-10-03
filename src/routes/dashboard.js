const { getLatestHealthData } = require('../services/healthCheckService');
const { generateSummary } = require('../utils/helpers');
const { EXTERNAL_SOURCES } = require('../config/sources');


const express = require('express');
const router = express.Router();

// Root endpoint with HTML dashboard (reads from database)
router.get('/', async (req, res) => {
  try {
    const results = await getLatestHealthData();
    const summary = generateSummary(results);
    
    res.render('dashboard', { 
      summary: summary,
      externalSources: EXTERNAL_SOURCES
    });
  } catch (error) {
    res.status(500).render('error', {
      title: 'Error',
      message: `Failed to check system health: ${error.message}`
    });
  }
});


module.exports = router;