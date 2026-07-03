export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const { origin, destination, date, adults = 1 } = body;

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
            cabin_class: "economy"
          }
        })
      }
    );

    const offerRequestData = await offerRequestRes.json();

    if (!offerRequestData?.data?.id) {
      return res.status(400).json({
        error: "Offer request failed",
        details: offerRequestData
      });
    }

    const offerRequestId = offerRequestData.data.id;

    // =========================
    // 2. RETRY LOGIC (IMPORTANT FIX)
    // =========================
    let offersData = null;

    for (let i = 0; i < 3; i++) {

      const offersRes = await fetch(
        `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
        { headers }
      );

      offersData = await offersRes.json();

      if (offersData?.data?.length > 0) break;

      await new Promise(r => setTimeout(r, 1200)); // wait 1.2s
    }

    return res.status(200).json(offersData);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
