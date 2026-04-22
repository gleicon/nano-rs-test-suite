export default {
  async fetch(request) {
    return new Response('Hello from App2', { status: 200 });
  }
};