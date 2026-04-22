export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-write') {
      try {
        await Nano.fs.writeFile('/tmp/test.txt', 'test-content');
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-read') {
      try {
        const content = await Nano.fs.readFile('/tmp/test.txt');
        return new Response(content, { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};