async function performManualCheck() {
    const btn = document.getElementById('manualCheckBtn');
    const status = document.getElementById('checkStatus');
    
    btn.disabled = true;
 //   btn.textContent = 'Checking...';
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
