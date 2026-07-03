export default async function handler(req, res) {
  try {

    const DUFFEL_API_TOKEN = "duffel_live_rAJGPmsj1X_o5Fbvr9MMjGi1WAF-O2cYjzvjzXsSQLw";

    const response = await fetch("https://api.duffel.com/air/offer_requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {
          slices: [
            {
              origin: "JFK",
              destination: "LHR",
              departure_date: "2026-12-01"
            }
          ],
          passengers: [
            { type: "adult" }
          ]
        }
      })
    });

    const data = await response.json();

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
