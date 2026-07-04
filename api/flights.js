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
      return_date
    } = req.body || {};

    if (!origin || !destination || !departure_date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: req.body
      });
    }

    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departure_date,
      api_key: process.env.SERPAPI_KEY
    });

    // only add return_date if round trip
    if (return_date) {
      params.append("return_date", return_date);
    }

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    console.log("🔎 SerpAPI Request:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("📦 SerpAPI Response Keys:", Object.keys(data));

    // 🔥 IMPORTANT: SerpAPI returns different arrays depending on route
    const flights =
      data.best_flights ||
      data.other_flights ||
      data.flights ||
      [];

    if (!flights.length) {
      console.log("⚠️ No flights found for request");
    }

    const offers = flights.map(f => {
      const legs = f.flights || [];

      const segments = legs.map(l => ({
        marketing_carrier: {
          name: l.airline || "Airline"
        },
        departing_at:
          l.departure_airport?.time ||
          l.departure_airport?.datetime ||
          null,
        arriving_at:
          l.arrival_airport?.time ||
          l.arrival_airport?.datetime ||
          null
      }));

      return {
        price: f.price || f.total_price || 0,
        total_currency: f.currency || "USD",
        slices: [
          {
            segments
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
    console.error("❌ Flight API Error:", err);

    return res.status(500).json({
      error: "Failed to fetch flights",
      message: err.message
    });
  }
}
