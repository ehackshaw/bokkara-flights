export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { origin, destination, date, adults = 1 } = req.body || {};

  if (!origin || !destination || !date) {
    return res.status(400).json({
      error: "Missing required fields",
      received: req.body
    });
  }

  const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

  const headers = {
    Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
    "Content-Type": "application/json",
    "Duffel-Version": "2023-11-27"
  };

  try {

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
            passengers: Array.from({ length: adults }, () => ({
              type: "adult"
            }))
          }
        })
      }
    );

    const offerRequestData = await offerRequestRes.json();

    return res.status(200).json(offerRequestData);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
