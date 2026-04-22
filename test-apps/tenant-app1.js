export default {
  async fetch(request) {
    return new Response('Hello from App1', { status: 200 });
  }
};