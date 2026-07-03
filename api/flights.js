export default async function handler(req, res) {

  // اجازه دادن به Shopify (CORS FIX)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

    const body = req.body || {};

    const origin = body.origin;
    const destination = body.destination;
    const date = body.date;
    const adults = body.adults || 1;

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    return res.status(200).json({
      message: "Success",
      received: body
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
