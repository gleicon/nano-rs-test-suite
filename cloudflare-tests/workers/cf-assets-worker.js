
// Cloudflare Worker serving static assets
// This pattern is common for SPAs, documentation sites, etc.

const ASSET_MANIFEST = {
  '/': { file: 'index.html', type: 'text/html' },
  '/index.html': { file: 'index.html', type: 'text/html' },
  '/styles.css': { file: 'styles.css', type: 'text/css' },
  '/app.js': { file: 'app.js', type: 'application/javascript' },
  '/config.json': { file: 'config.json', type: 'application/json' }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API endpoint
    if (url.pathname === '/api/status') {
      return new Response(JSON.stringify({
        status: 'ok',
        platform: 'nano-rs',
        cf_compatible: true,
        assets_served: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Serve static assets
    const asset = ASSET_MANIFEST[url.pathname];
    if (asset) {
      try {
        // In a real CF Worker, you'd use env.ASSETS or similar
        // Here we construct the response directly
        const content = 
          asset.file === 'index.html' ? `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Cloudflare Worker on nano-rs</title>
    <style>body { font-family: sans-serif; margin: 50px; }</style>
</head>
<body>
    <h1>🌩️ Cloudflare Worker</h1>
    <p>✅ Running on nano-rs edge runtime</p>
    <script src="/app.js"></script>
</body>
</html>` :
          asset.file === 'styles.css' ? `body { background: #f5f5f5; }` :
          asset.file === 'app.js' ? `console.log('CF Worker client loaded'); fetch('/api/status').then(r=>r.json()).then(d=>console.log(d));` :
          asset.file === 'config.json' ? JSON.stringify({ name: 'cf-worker', version: '1.0.0' }) :
          'Not found';
        
        return new Response(content, {
          headers: { 
            'Content-Type': asset.type,
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (e) {
        return new Response('Asset error: ' + e.message, { status: 500 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
