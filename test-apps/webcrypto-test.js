export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-crypto') {
      return new Response(crypto && crypto.subtle ? 'OK' : 'FAIL', { status: 200 });
    }
    
    if (url.pathname === '/test-aes') {
      try {
        await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};