/**
 * B·W CABLE — Categories KV API
 * Cloudflare Pages Function: /api/categories
 *
 * GET  — Read product categories from KV, fallback to data/categories.json
 * POST — Write categories to KV (requires Bearer auth token)
 *
 * Reuses the same KV namespace (ARTICLES_KV) with key 'categories_data'.
 */
const KV_KEY = 'categories_data';
const AUTH_TOKEN = 'bw_auth_ok';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  // ---- GET: fetch categories ----
  if (method === 'GET') {
    try {
      const kvData = await env.ARTICLES_KV.get(KV_KEY, 'json');
      if (kvData && Array.isArray(kvData)) {
        return new Response(JSON.stringify(kvData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
        });
      }

      // Fallback: read static categories.json from the deployed site
      try {
        const staticUrl = new URL('/data/categories.json', request.url);
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
      return new Response(JSON.stringify({ error: 'Failed to load categories' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ---- POST: save categories ----
  if (method === 'POST') {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '').trim();

      if (token !== AUTH_TOKEN) {
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

      await env.ARTICLES_KV.put(KV_KEY, JSON.stringify(body));

      return new Response(JSON.stringify({
        success: true,
        message: '✅ 分类已同步保存至 Cloudflare 全球云端！',
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
