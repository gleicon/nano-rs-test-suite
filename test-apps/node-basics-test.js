export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-console') {
      console.log('test');
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/test-buffer') {
      const buf = Buffer.from('test');
      return new Response(buf.toString() === 'test' ? 'OK' : 'FAIL', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  }
};