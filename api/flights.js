export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const {
      origin,
      destination,
      departure_date,
      return_date,
      type
    } = req.body;

    if (!origin || !destination || !departure_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build SerpAPI query
    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departure_date,
      type: return_date ? "2" : "1",
      api_key: process.env.SERPAPI_KEY
    });

    if (return_date) {
      params.append("return_date", return_date);
    }

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    // Extract flights
    const flights =
      data.best_flights ||
      data.other_flights ||
      [];

    // Normalize into YOUR frontend format
    const offers = flights.map(f => {
      const legs = f.flights || [];

      return {
        price: f.price || 0,
        total_currency: "USD",

        slices: [
          {
            segments: legs.map(l => ({
              marketing_carrier: {
                name: l.airline || "Airline"
              },

              departing_at: l.departure_airport?.time || null,
              arriving_at: l.arrival_airport?.time || null
            }))
          }
        ]
      };
    });

    return res.status(200).json({
      data: {
        offers
      }
    });

  } catch (err) {
    console.error("Flight API Error:", err);

    return res.status(500).json({
      error: "Failed to fetch flights"
    });
  }
}
