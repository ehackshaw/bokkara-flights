export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

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
    // CLEAN CABIN HANDLING
    // =========================
    const allowedCabins = [
      "economy",
      "premium_economy",
      "business",
      "first"
    ];

    const cabin_class = allowedCabins.includes(
      (cabin || "").toLowerCase().trim()
    )
      ? (cabin || "").toLowerCase().trim()
      : "economy";

    // =========================
    // FUNCTION: CREATE + FETCH OFFERS
    // =========================
    async function getOffers(cabinType) {

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
              cabin_class: cabinType
            }
          })
        }
      );

      const offerRequestData = await offerRequestRes.json();

      if (!offerRequestData.data?.id) {
        return null;
      }

      const offerRequestId = offerRequestData.data.id;

      const offersRes = await fetch(
        `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
        {
          method: "GET",
          headers
        }
      );

      const offersData = await offersRes.json();

      return offersData.data || [];
    }

    // =========================
    // 1. TRY SELECTED CABIN
    // =========================
    let offers = await getOffers(cabin_class);

    // =========================
    // 2. FALLBACK IF EMPTY
    // =========================
    if (!offers || offers.length === 0) {
      console.log(`No offers for ${cabin_class}, falling back to economy...`);
      offers = await getOffers("economy");
    }

    return res.status(200).json({
      data: offers
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
