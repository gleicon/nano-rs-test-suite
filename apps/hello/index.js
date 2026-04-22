// nano-rs compatible handler
// REQUIRED: Classic script mode (no ESM export/import)
// REQUIRED: Global `fetch` function (overrides built-in fetch API)
// NOTE: request arg is a JSON string {"method":"GET"} - URL/headers/body NOT passed (bug)
// NOTE: return value must be plain sync object {status, headers, body} - no Promises (limitation)

function fetch(requestJson) {
  return {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: 'Hello from nano-rs! (classic script mode)',
  };
}
