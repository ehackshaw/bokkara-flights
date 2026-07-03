export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

    // Parse body safely
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const {
      origin,
      destination,
      date,
      adults = 1,
      cabin = "economy"
    } = body;

    // Validate input
    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

    const headers = {
      Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
      "Content-Type": "application/json",
      "Duffel-Version": "2023-01-23"
    };

    // Allowed cabins (safety layer)
    const allowedCabins = [
      "economy",
      "premium_economy",
      "business",
      "first"
    ];

    const cabin_class = allowedCabins.includes(cabin)
      ? cabin
      : "economy";

    // =========================
    // 1. CREATE OFFER REQUEST
    // =========================
    const offerRequestRes = await fetch(
      "https://api.duffel.com/air/offer_requests",
      {
        method: "POST",
        headers,
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

            // ✅ THIS IS THE CRITICAL FIX
            cabin_class: cabin_class
          }
        })
      }
    );

    const offerRequestData = await offerRequestRes.json();

    if (!offerRequestData.data?.id) {
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
        headers
      }
    );

    const offersData = await offersRes.json();

    // Debug (remove later if you want)
    console.log("CABIN USED:", cabin_class);

    return res.status(200).json(offersData);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
