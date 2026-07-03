export default async function handler(req, res) {
  try {
    // =========================
    // PARSE REQUEST BODY SAFELY
    // =========================
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const { origin, destination, date, adults } = body;

    // =========================
    // VALIDATION (IMPORTANT)
    // =========================
    if (!origin || !destination || !date || !adults) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

    // =========================
    // 1. CREATE OFFER REQUEST
    // =========================
    const offerRequest = await fetch(
      "https://api.duffel.com/air/offer_requests",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DUFFEL_API_TOKEN}`,
          "Content-Type": "application/json",
          "Duffel-Version": "v2"
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

    const offerRequestData = await offerRequest.json();

    if (!offerRequest.ok) {
      return res.status(400).json({
        error: "Offer request failed",
        details: offerRequestData
      });
    }

    const offerRequestId = offerRequestData.data.id;

    // =========================
    // 2. GET OFFERS
    // =========================
    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
      {
        headers: {
          "Authorization": `Bearer ${DUFFEL_API_TOKEN}`,
          "Duffel-Version": "v2"
        }
      }
    );

    const offersData = await offersRes.json();

    if (!offersRes.ok) {
      return res.status(400).json({
        error: "Failed to fetch offers",
        details: offersData
      });
    }

    // =========================
    // RETURN RESULTS
    // =========================
    return res.status(200).json(offersData);

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}
