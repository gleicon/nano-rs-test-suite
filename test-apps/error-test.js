export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/throw-error') {
      throw new Error('Intentional error');
    }
    
    return new Response('OK', { status: 200 });
  }
};