export default async function handler(req, res) {
  try {

    // Always log what we receive (for debugging)
    const body = req.body || {};

    const origin = body.origin || null;
    const destination = body.destination || null;
    const date = body.date || null;
    const adults = body.adults || 1;

    // NEVER crash — always return safe response first
    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    return res.status(200).json({
      message: "Backend is stable",
      received: body
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server crashed safely",
      message: err.message
    });
  }
}
