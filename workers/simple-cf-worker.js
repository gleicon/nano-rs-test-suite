
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Simple test endpoint
    if (url.pathname === '/test') {
      return new Response('CF Worker works!', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // JSON endpoint
    if (url.pathname === '/json') {
      return new Response(JSON.stringify({
        message: 'Hello from CF Worker',
        version: '1.2.2',
        platform: 'nano-rs'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
