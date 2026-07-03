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
        error: "Missing required fields"
      });
    }

    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

    const headers = {
      Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
      "Content-Type": "application/json",
      "Duffel-Version": "2023-01-23"
    };

    // normalize cabin
    const cabin_class = (cabin || "economy").toLowerCase();

    // VALID CABINS ONLY
    const validCabins = ["economy", "business", "first"];

    const finalCabin = validCabins.includes(cabin_class)
      ? cabin_class
      : "economy";

    // =========================
    // CREATE OFFER REQUEST
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

            // IMPORTANT: cabin filter
            cabin_class: finalCabin
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
    // FETCH OFFERS
    // =========================
    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
      {
        method: "GET",
        headers
      }
    );

    const offersData = await offersRes.json();

    const offers = offersData.data || [];

    // IMPORTANT DEBUG (keep for now)
    console.log("CABIN:", finalCabin);
    console.log("OFFERS COUNT:", offers.length);

    return res.status(200).json({
      data: offers
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
