export default async function handler(req, res) {
  // =========================
  // CORS SETUP (REQUIRED FOR SHOPIFY)
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // =========================
    // SAFE BODY PARSING
    // =========================
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const { origin, destination, date, adults = 1 } = body;

    // =========================
    // VALIDATION
    // =========================
    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    // =========================
    // ENV TOKEN (NO HARDCODING)
    // =========================
    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

    if (!DUFFEL_API_TOKEN) {
      return res.status(500).json({
        error: "Missing DUFFEL_API_TOKEN in environment variables"
      });
    }

    // =========================
    // 1. CREATE OFFER REQUEST
    // =========================
    const offerRequestRes = await fetch(
      "https://api.duffel.com/air/offer_requests",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin,
                destination,
                departure_date: date
              }
            ],
            passengers: Array.from({ length: Number(adults) }, () => ({
              type: "adult"
            })),
            cabin_class: "economy"
          }
        })
      }
    );

    const offerRequestData = await offerRequestRes.json();

    if (!offerRequestData.data) {
      return res.status(400).json({
        error: "Duffel offer request failed",
        details: offerRequestData
      });
    }

    const offerRequestId = offerRequestData.data.id;

    // =========================
    // 2. FETCH OFFERS
    // =========================
    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const offersData = await offersRes.json();

    // =========================
    // RETURN RESULTS
    // =========================
    return res.status(200).json(offersData);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
