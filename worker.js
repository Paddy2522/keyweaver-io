export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let assetRequest = request;
    if (url.pathname === '/' || url.pathname === '') {
      assetRequest = new Request(new URL('/index.html', url), request);
    }
    const response = await env.ASSETS.fetch(assetRequest);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
