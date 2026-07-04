export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    let {
      origin,
      destination,
      date,
      adults = 1
    } = body;

    origin = String(origin || "").trim().toUpperCase();
    destination = String(destination || "").trim().toUpperCase();
    date = String(date || "").trim();

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

    if (!DUFFEL_API_TOKEN) {
      return res.status(500).json({
        error: "Missing DUFFEL_API_TOKEN environment variable."
      });
    }

    const headers = {
      Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
      "Content-Type": "application/json",
      "Duffel-Version": "2023-01-23"
    };

    // -------------------------
    // Offer Request Body
    // -------------------------

    const offerRequestBody = {
      data: {
        slices: [
          {
            origin,
            destination,
            departure_date: date
          }
        ],
        passengers: Array.from(
          { length: Number(adults) || 1 },
          () => ({
            type: "adult"
          })
        ),
        cabin_class: "economy"
      }
    };

    console.log("Duffel Request:");
    console.log(JSON.stringify(offerRequestBody, null, 2));

    // -------------------------
    // Create Offer Request
    // -------------------------

    const offerRequestRes = await fetch(
      "https://api.duffel.com/air/offer_requests",
      {
        method: "POST",
        headers,
        body: JSON.stringify(offerRequestBody)
      }
    );

    const offerRequestText = await offerRequestRes.text();

    let offerRequestData;

    try {
      offerRequestData = JSON.parse(offerRequestText);
    } catch {
      return res.status(500).json({
        error: "Duffel returned invalid JSON",
        raw: offerRequestText
      });
    }

    // -------------------------
    // Show REAL Duffel error
    // -------------------------

    if (!offerRequestRes.ok) {
      console.error("Duffel Error:");
      console.error(JSON.stringify(offerRequestData, null, 2));

      return res.status(offerRequestRes.status).json({
        error: "Duffel offer request failed",
        status: offerRequestRes.status,
        details: offerRequestData
      });
    }

    const offerRequestId = offerRequestData?.data?.id;

    if (!offerRequestId) {
      return res.status(500).json({
        error: "Duffel did not return an offer request ID.",
        details: offerRequestData
      });
    }

    // -------------------------
    // Fetch Offers
    // -------------------------

    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
      {
        headers
      }
    );

    const offersText = await offersRes.text();

    let offersData;

    try {
      offersData = JSON.parse(offersText);
    } catch {
      return res.status(500).json({
        error: "Duffel returned invalid offers JSON",
        raw: offersText
      });
    }

    if (!offersRes.ok) {
      return res.status(offersRes.status).json({
        error: "Duffel offers request failed",
        details: offersData
      });
    }

    return res.status(200).json(offersData);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
