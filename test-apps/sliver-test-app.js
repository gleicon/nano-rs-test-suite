let counter = 0;
export default {
  async fetch(request) {
    counter++;
    return new Response(JSON.stringify({ counter, timestamp: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};