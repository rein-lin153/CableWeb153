/**
 * B·W CABLE — Articles KV API
 * Cloudflare Pages Function: /api/articles
 *
 * GET  — Read articles from KV, fallback to data/articles.json
 * POST — Write articles to KV (requires Bearer auth token)
 */
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  // ---- GET: fetch articles ----
  if (method === 'GET') {
    try {
      // Try KV first
      const kvData = await env.ARTICLES_KV.get('articles_data', 'json');
      if (kvData && Array.isArray(kvData)) {
        return new Response(JSON.stringify(kvData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
        });
      }

      // Fallback: read static articles.json from the deployed site
      try {
        const staticUrl = new URL('/data/articles.json', request.url);
        const staticRes = await fetch(staticUrl);
        if (staticRes.ok) {
          const data = await staticRes.json();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
          });
        }
      } catch (_) {
        // Fallback fetch may fail in dev; return empty array
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to load articles' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ---- POST: save articles ----
  if (method === 'POST') {
    try {
      // Auth check: Bearer token
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '').trim();

      if (token !== 'bw_admin_authenticated_session') {
        return new Response(JSON.stringify({ success: false, message: '未授权访问 (Unauthorized)' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      if (!Array.isArray(body)) {
        return new Response(JSON.stringify({ success: false, message: '数据格式无效，应为数组 (Expected JSON array)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await env.ARTICLES_KV.put('articles_data', JSON.stringify(body));

      return new Response(JSON.stringify({
        success: true,
        message: '✅ 文章已同步保存至 Cloudflare 全球云端！',
        count: body.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: '保存失败 (Save failed): ' + err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ---- Other methods ----
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}