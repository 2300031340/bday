/**
 * Vercel API route to provide config from environment variables
 */

export default function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return non-sensitive config from environment variables
  return res.status(200).json({
    MADHU_STAR_CHART_LAT: process.env.MADHU_STAR_CHART_LAT || "16.3067",
    MADHU_STAR_CHART_LON: process.env.MADHU_STAR_CHART_LON || "80.4365",
    MADHU_STAR_CHART_DATE: process.env.MADHU_STAR_CHART_DATE || "2006-06-30",
    MADHU_STAR_CHART_CONSTELLATION: process.env.MADHU_STAR_CHART_CONSTELLATION || "cnc",
    MADHU_STAR_CHART_STYLE: process.env.MADHU_STAR_CHART_STYLE || "navy",
  });
}
