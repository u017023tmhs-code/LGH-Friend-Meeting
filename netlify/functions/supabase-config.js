/**
 * Netlify Serverless Function: supabase-config
 * 用途：安全將 Netlify 後台環境變數（SUPABASE_URL 與 SUPABASE_ANON_KEY）透通給前端靜態網頁
 */

exports.handler = async (event, context) => {
  // 檢查所有可能設定的環境變數名稱
  const supabaseUrl = 
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    '';

  const supabaseAnonKey = 
    process.env.SUPABASE_ANON_KEY || 
    process.env.SUPABASE_KEY || 
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    '';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    },
    body: JSON.stringify({
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      configured: Boolean(supabaseUrl && supabaseAnonKey)
    })
  };
};
