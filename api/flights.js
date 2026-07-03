export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

    const body = JSON.parse(JSON.stringify(req.body || {}));

    const { origin, destination, date, adults = 1 } = body;

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

    // 🔥 FORCE HEADERS OBJECT (NO INLINE SPREAD ISSUES)
    const headers = new Map();
    headers.set("Authorization", `Bearer ${DUFFEL_API_TOKEN}`);
    headers.set("Content-Type", "application/json");
    headers.set("Duffel-Version", "v1");

    const headerObject = Object.fromEntries(headers);

    // =========================
    // 1. OFFER REQUEST
    // =========================
    const offerRequestRes = await fetch(
      "https://api.duffel.com/air/offer_requests",
      {
        method: "POST",
        headers: headerObject,
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin,
                destination,
                departure_date: date
              }
            ],
            passengers: Array.from({ length: adults }, () => ({
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
        headers: headerObject
      }
    );

    const offersData = await offersRes.json();

    return res.status(200).json(offersData);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
