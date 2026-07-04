export default async function handler(req, res) {
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

    const origin = String(body.origin || "").trim().toUpperCase();
    const destination = String(body.destination || "").trim().toUpperCase();
    const date = String(body.date || "").trim();
    const adults = Number(body.adults || 1);

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const token = process.env.DUFFEL_API_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "DUFFEL_API_TOKEN is missing."
      });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Duffel-Version": "2023-01-23"
    };

    const offerBody = {
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
    };

    console.log("Sending to Duffel:");
    console.log(JSON.stringify(offerBody, null, 2));

    const offerRequestRes = await fetch(
      "https://api.duffel.com/air/offer_requests",
      {
        method: "POST",
        headers,
        body: JSON.stringify(offerBody)
      }
    );

    const offerRequestData = await offerRequestRes.json();

    // IMPORTANT: Return Duffel's response exactly
    if (!offerRequestRes.ok) {
      console.error("Duffel Response:");
      console.error(JSON.stringify(offerRequestData, null, 2));

      return res.status(offerRequestRes.status).json(offerRequestData);
    }

    const offerRequestId = offerRequestData.data.id;

    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}`,
      {
        headers
      }
    );

    const offersData = await offersRes.json();

    if (!offersRes.ok) {
      return res.status(offersRes.status).json(offersData);
    }

    return res.status(200).json(offersData);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
