export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-fetch') {
      return new Response(typeof fetch === 'function' ? 'OK' : 'FAIL', { status: 200 });
    }
    
    if (url.pathname === '/test-request-response') {
      const req = new Request('http://test.com', { method: 'POST', body: 'test' });
      const res = new Response('test', { status: 200 });
      return new Response(res.status === 200 ? 'OK' : 'FAIL', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  }
};