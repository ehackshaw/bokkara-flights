export default async function handler(req, res) {
  try {
    const { origin, destination, date, adults } =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;

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
            passengers: Array.from({ length: adults }, () => ({
              type: "adult"
            }))
          }
        })
      }
    );

    const offerRequestData = await offerRequest.json();

    if (!offerRequest.ok) {
      return res.status(400).json(offerRequestData);
    }

    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestData.data.id}`,
      {
        headers: {
          "Authorization": `Bearer ${DUFFEL_API_TOKEN}`,
          "Duffel-Version": "v2"
        }
      }
    );

    const offersData = await offersRes.json();

    res.status(200).json(offersData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
