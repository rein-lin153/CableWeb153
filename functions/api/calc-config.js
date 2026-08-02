/**
 * B·W CABLE — Calculator Config KV API
 * Cloudflare Pages Function: /api/calc-config
 *
 * GET  — Read calculator config (object) from KV, fallback to data/calc-config.json
 * POST — Write calculator config object to KV (requires Bearer auth token)
 *
 * Key difference from products.js: config data uses Cache-Control: no-store
 * so that admin changes take effect on the public page immediately.
 *
 * Reuses the same KV namespace (ARTICLES_KV) with key 'calc_config_data'.
 */
const KV_KEY = 'calc_config_data';
const AUTH_TOKEN = 'bw_auth_ok';

// Last-resort default if neither KV nor static json is available.
const DEFAULT_CONFIG = {
  copperPriceUsdPerKg: 9,
  edcTiers: [
    { upTo: 50, rate: 610 },
    { upTo: 100, rate: 770 },
    { upTo: 200, rate: 920 },
    { upTo: 300, rate: 1090 },
    { upTo: 400, rate: 1280 },
    { upTo: 99999, rate: 1480 }
  ],
  edcCommercialRate: 920,
  edcUsdRielRate: 4100,
  edcNotes: 'EDC 阶梯近似值，请管理员后台更新为最新电价'
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  // ---- GET: fetch calculator config ----
  if (method === 'GET') {
    try {
      const kvData = await env.ARTICLES_KV.get(KV_KEY, 'json');
      if (kvData && typeof kvData === 'object') {
        return new Response(JSON.stringify(kvData), {
          status: 200,
          headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' }
        });
      }

      // Fallback: read static calc-config.json from the deployed site
      try {
        const staticUrl = new URL('/data/calc-config.json', request.url);
        const staticRes = await fetch(staticUrl);
        if (staticRes.ok) {
          const data = await staticRes.json();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' }
          });
        }
      } catch (_) {
        // Fallback fetch may fail in dev; fall through to default
      }

      return new Response(JSON.stringify(DEFAULT_CONFIG), {
        status: 200,
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to load calc config', config: DEFAULT_CONFIG }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }
  }

  // ---- POST: save calculator config ----
  if (method === 'POST') {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '').trim();

      if (token !== AUTH_TOKEN) {
        return new Response(JSON.stringify({ success: false, message: '未授权访问 (Unauthorized)' }), {
          status: 401,
          headers: JSON_HEADERS
        });
      }

      const body = await request.json();
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return new Response(JSON.stringify({ success: false, message: '配置数据格式无效，应为 JSON 对象 (Expected JSON object)' }), {
          status: 400,
          headers: JSON_HEADERS
        });
      }

      await env.ARTICLES_KV.put(KV_KEY, JSON.stringify(body));

      return new Response(JSON.stringify({
        success: true,
        message: '✅ 计算器配置已同步保存至 Cloudflare 全球云端！'
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: '保存失败 (Save failed): ' + err.message }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }
  }

  // ---- Other methods ----
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: JSON_HEADERS
  });
}
