export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    res.status(500).json({ ok: false, error: 'Supabase env vars not configured on Vercel' })
    return
  }

  try {
    const response = await fetch(`${url}/rest/v1/estoque?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    res.status(200).json({ ok: response.ok, status: response.status, ts: new Date().toISOString() })
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) })
  }
}
