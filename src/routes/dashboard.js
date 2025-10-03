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
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Library Services Health Monitor</title>
        <link rel="stylesheet" href="/css/styles.css">
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Library Services Health Monitor</h1>
            </div>

            <strong>Last Database Update:</strong> <span id="lastUpdate">${new Date(summary.checkTime).toLocaleString()}</span><br><br>
            <button class="check-btn" onclick="performManualCheck()" id="manualCheckBtn">🔄 Run Health Check Now</button>
            <span id="checkStatus"></span>
        
        
            ${summary.sources.map(source => `
                <div class="source ${source.status === 'OK' ? 'ok' : 'error'}">
                    <a href="${EXTERNAL_SOURCES.find(s => s.name === source.name)?.url || '#'}" target="_blank" class="external-link" title="View ${source.name} source">↗︎</a>
                    <strong>${source.name}</strong>
                    <span class="status ${source.status === 'OK' ? 'ok' : 'error'}">[${source.status}]</span>
                    ${source.responseTime ? `<div class="response-time">Response Time: ${source.responseTime}ms</div>` : ''}
                    ${source.lastUpdated ? `<div class="response-time">Last Updated: ${new Date(source.lastUpdated).toLocaleString()}</div>` : ''}
                    ${source.errorMessage ? `<div class="error">Error: ${source.errorMessage}</div>` : ''}
                    ${source.htmlData ? `
                        <div class="html-details">
                            <strong>Components:</strong> ${source.htmlData.totalComponents} total, 
                            ${source.htmlData.healthyCount} healthy, ${source.htmlData.errorCount} with issues
                            ${source.htmlData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View Components</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.htmlData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.details && comp.details.url ? `<br><a href="${comp.details.url}" target="_blank" class="source-link">⧉ View Post</a>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${source.xmlData ? `
                        <div class="xml-details">
                            <strong>Services:</strong> ${source.xmlData.totalComponents} total, 
                            ${source.xmlData.healthyCount} operational, ${source.xmlData.errorCount} with issues
                            ${source.xmlData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View Services</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.xmlData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.errorMessages.length > 0 ? `<br><span style="color:#666; font-size:0.9em;">Issues: ${comp.errorMessages.join(', ')}</span>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${source.rssData ? `
                        <div class="rss-details">
                            <strong>RSS Items:</strong> ${source.rssData.totalComponents} total, 
                            ${source.rssData.healthyCount} normal, ${source.rssData.errorCount} issues
                            ${source.rssData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View RSS Items</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.rssData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.details && comp.details.description ? `<br><span style="color:#666; font-size:0.9em;">${comp.details.description}</span>` : ''}
                                            ${comp.details && comp.details.pubDate ? `<br><span style="color:#888; font-size:0.8em;">Published: ${comp.details.pubDate}</span>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${source.jsonData ? `
                        <div class="json-details">
                            <strong>JSON Services:</strong> ${source.jsonData.totalComponents} total, 
                            ${source.jsonData.totalComponents - source.jsonData.errorCount} operational, ${source.jsonData.errorCount} with issues
                            ${source.jsonData.components.length > 0 ? `
                                <details style="margin-top: 10px;">
                                    <summary>View JSON Services</summary>
                                    <ul style="margin: 5px 0;">
                                        ${source.jsonData.components.map(comp => 
                                            `<li><strong>${comp.name}:</strong> ${comp.status} ${comp.isError ? '❌' : '✅'}
                                            ${comp.statusText ? `<br><span style="color:#666; font-size:0.9em;">Status: ${comp.statusText}</span>` : ''}</li>`
                                        ).join('')}
                                    </ul>
                                </details>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
                        
            <div style="margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                <strong>API Endpoints:</strong><br>
                <a href="/health">/health</a> - JSON summary (from database)
            </div>
        </div>
        
        <script>
            async function performManualCheck() {
                const btn = document.getElementById('manualCheckBtn');
                const status = document.getElementById('checkStatus');
                
                btn.disabled = true;
                btn.textContent = 'Checking...';
                status.textContent = 'Performing health checks...';
                status.style.color = '#666';
                
                try {
                    const response = await fetch('/health/check', { method: 'POST' });
                    const data = await response.json();
                    
                    if (response.ok) {
                        status.textContent = '✅ Health check completed! Refreshing page...';
                        status.style.color = 'green';
                        
                        // Refresh page after 2 seconds
                        setTimeout(() => {
                            location.reload();
                        }, 2000);
                    } else {
                        status.textContent = '❌ ' + (data.message || 'Health check failed');
                        status.style.color = 'red';
                    }
                } catch (error) {
                    status.textContent = '❌ Error: ' + error.message;
                    status.style.color = 'red';
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Run Health Check Now';
                }
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <h1>Error</h1>
      <p>Failed to check system health: ${error.message}</p>
    `);
  }
});


module.exports = router;