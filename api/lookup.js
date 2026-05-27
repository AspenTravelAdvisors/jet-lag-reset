// Serverless proxy for Aerodatabox flight lookup.
// Keeps the RapidAPI key on the server so it never ships to the browser.
// Vercel automatically routes /api/lookup to this file.

export default async function handler(req, res) {
  const { num, date } = req.query || {};

  if (!num || !date) {
    return res.status(400).json({ error: 'Missing num or date query parameter.' });
  }

  const code = String(num).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid flight number format.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date. Expected YYYY-MM-DD.' });
  }

  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'Server is missing RAPIDAPI_KEY. Set it in Vercel project settings.'
    });
  }

  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${code}/${date}?dateLocalRole=Departure`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      }
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({
        error: `Upstream returned HTTP ${upstream.status}`,
        detail: text.slice(0, 200)
      });
    }

    const data = await upstream.json();
    // Cache successful lookups for 5 minutes — flight schedules rarely change minute-to-minute.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream fetch failed.', detail: String(err.message || err) });
  }
}
