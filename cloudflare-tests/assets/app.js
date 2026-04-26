// Cloudflare Worker Client Script
console.log('🌩️ CF Worker client loaded');

// Test API endpoint
fetch('/api/status')
  .then(r => r.json())
  .then(data => {
    console.log('API status:', data);
    const resultDiv = document.getElementById('api-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p>API Status: ' + data.status + '</p>';
    }
  })
  .catch(e => console.error('API error:', e));