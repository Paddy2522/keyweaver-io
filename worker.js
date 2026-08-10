export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Prefer HTTPS for crawl/index consistency (drops duplicate http:// URLs).
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const path = url.pathname;
    const lower = path.toLowerCase();

    // Non-content paths Google has discovered from JS strings / Stream UI.
    // Real APIs live on keyweaver-backend.vercel.app — these hosts must stay out of the index.
    const isJunk =
      lower === '/api' ||
      lower.startsWith('/api/') ||
      lower === '/manifest' ||
      lower.startsWith('/manifest/') ||
      lower === '/downloads' ||
      lower === '/downloads/';

    if (isJunk) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    let assetRequest = request;
    if (path === '/' || path === '') {
      assetRequest = new Request(new URL('/index.html', url), request);
    }

    const response = await env.ASSETS.fetch(assetRequest);
    const contentType = response.headers.get('content-type') || '';
    const pathLower = lower;
    const isHtml = contentType.includes('text/html');
    const isJsOrCss =
      pathLower.endsWith('.js') || pathLower.endsWith('.css') || pathLower.endsWith('.json');
    const isRobots = pathLower === '/robots.txt' || pathLower === '/sitemap.xml';

    const headers = new Headers(response.headers);

    // Soft-signal: never index error pages even if a crawler keeps the URL.
    if (response.status === 404 || response.status === 410) {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    if (isRobots) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (!isHtml && !isJsOrCss) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

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
