/**
 * B·W CABLE — Admin Login API
 * Cloudflare Pages Function: POST /api/login
 * Validates password against KV-stored admin credential
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { password } = body || {};

    if (!password) {
      return new Response(JSON.stringify({ success: false, message: '请输入管理员密码 (Password required)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Read admin password from env var or use default
    const adminPassword = env.ADMIN_PASSWORD || 'BwCable2026!';

    if (password !== adminPassword) {
      return new Response(JSON.stringify({ success: false, message: '密码错误，请重试 (Invalid password)' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return session token for frontend auth verification
    return new Response(JSON.stringify({
      success: true,
      token: 'bw_auth_ok'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: '请求格式无效 (Invalid request format)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}