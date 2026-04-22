export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const method = request.method;
    
    const routes = {
      '/test-get': 'GET',
      '/test-post': 'POST',
      '/test-put': 'PUT',
      '/test-patch': 'PATCH',
      '/test-delete': 'DELETE',
      '/test-head': 'HEAD',
      '/test-options': 'OPTIONS'
    };
    
    for (const [route, expectedMethod] of Object.entries(routes)) {
      if (path === route && method === expectedMethod) {
        return new Response(expectedMethod + ' OK', { status: 200 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};