/**
 * Vercel API route to proxy star chart requests to AstronomyAPI
 * Avoids CORS issues when called from frontend
 * Uses environment variables for secure credential storage
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { body: requestBody } = req.body;

  // Get credentials from environment variables (secure on server)
  const appId = process.env.MADHU_ASTRONOMY_APP_ID;
  const appSecret = process.env.MADHU_ASTRONOMY_APP_SECRET;

  // Validate inputs
  if (!appId || !appSecret || !requestBody) {
    return res.status(400).json({ 
      error: 'Missing required parameters or environment variables',
      hasAppId: !!appId,
      hasAppSecret: !!appSecret,
      hasBody: !!requestBody
    });
  }

  try {
    // Create Basic auth header
    const auth = Buffer.from(`${appId}:${appSecret}`).toString('base64');

    // Call AstronomyAPI
    const response = await fetch('https://api.astronomyapi.com/api/v2/studio/star-chart', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || data.error || 'Star chart API error',
        details: data
      });
    }

    // Return the response
    return res.status(200).json(data);

  } catch (error) {
    console.error('Star chart proxy error:', error);
    return res.status(500).json({
      error: 'Failed to fetch star chart',
      message: error.message
    });
  }
}
