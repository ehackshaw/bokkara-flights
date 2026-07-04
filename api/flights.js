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

    // 🔥 CLEAN PARAMS (NO EXTRA NOISE)
    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departure_date,
      api_key: process.env.SERPAPI_KEY
    });

    if (return_date) {
      params.append("return_date", return_date);
    }

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    console.log("🔎 SERPAPI REQUEST:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("📦 SERPAPI RESPONSE KEYS:", Object.keys(data));

    // 🚨 DEBUG CHECK (IMPORTANT)
    if (data.error) {
      console.log("❌ SERPAPI ERROR:", data.error);
      return res.status(200).json({
        data: { offers: [] },
        error: data.error
      });
    }

    // 🔥 MULTI-SOURCE EXTRACTION (REAL FIX)
    const flights =
      data.best_flights ||
      data.other_flights ||
      data.flights_results ||
      data.search_results ||
      data.itineraries ||
      [];

    console.log("✈️ FLIGHTS FOUND:", flights.length);

    // 🚨 HARD DEBUG IF EMPTY
    if (!flights.length) {
      console.log("⚠️ FULL RESPONSE (NO FLIGHTS):", JSON.stringify(data, null, 2));

      return res.status(200).json({
        data: { offers: [] },
        debug: data
      });
    }

    // 🧠 NORMALIZE
    const offers = flights.map(f => {

      const legs = f.flights || f.segments || [];

      const segments = legs.map(l => ({
        marketing_carrier: {
          name: l.airline || l.carrier || "Airline"
        },
        departing_at:
          l.departure_airport?.time ||
          l.departure_airport?.datetime ||
          l.departure_time ||
          null,
        arriving_at:
          l.arrival_airport?.time ||
          l.arrival_airport?.datetime ||
          l.arrival_time ||
          null
      }));

      return {
        price: f.price || f.total_price || f.total_amount || 0,
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
    console.error("❌ BACKEND ERROR:", err);

    return res.status(500).json({
      error: "Failed to fetch flights",
      message: err.message
    });
  }
}
