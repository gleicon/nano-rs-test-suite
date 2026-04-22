export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/echo' && request.method === 'POST') {
      const body = await request.text();
      return new Response(body, { status: 200 });
    }
    return new Response('Hello from NANO!', { status: 200 });
  }
};