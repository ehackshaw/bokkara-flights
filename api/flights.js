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
    const body = req.body || {};

    console.log("🔥 Incoming request:", body);

    const origin = (body.origin || "").trim().toUpperCase();
    const destination = (body.destination || "").trim().toUpperCase();
    const departure_date = body.departure_date;
    const return_date = body.return_date;
    const type = body.type || "oneway";

    // NEW: stops filter from frontend
    const stops = body.max_stops ?? null;

    if (!origin || !destination || !departure_date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const params = new URLSearchParams();

    // Required SerpAPI params
    params.set("engine", "google_flights");
    params.set("departure_id", origin);
    params.set("arrival_id", destination);
    params.set("outbound_date", departure_date);
    params.set("currency", "USD");
    params.set("hl", "en");
    params.set("gl", "us");

    // Better results
    params.set("deep_search", "true");
    params.set("show_hidden", "true");
    params.set("sort_by", "2"); // cheapest first

    // Trip type
    if (type === "roundtrip") {
      params.set("type", "1");

      if (!return_date) {
        return res.status(400).json({
          error: "Return date required for roundtrip"
        });
      }

      params.set("return_date", return_date);
    } else {
      params.set("type", "2");
    }

    /**
     * =========================
     * STOPS FILTER (IMPORTANT)
     * =========================
     *
     * SerpAPI does NOT strictly enforce stops filtering.
     * This is a hint only.
     */
    if (stops !== null && stops !== undefined) {
      const stopValue = parseInt(stops);

      // safety clamp
      if ([0, 1, 2].includes(stopValue)) {
        params.set("stops", stopValue);
      }
    }

    // Optional filters
    if (body.travel_class) {
      params.set("travel_class", body.travel_class);
    }

    if (body.adults) {
      params.set("adults", body.adults);
    }

    if (body.children) {
      params.set("children", body.children);
    }

    if (body.max_price) {
      params.set("max_price", body.max_price);
    }

    if (body.include_airlines) {
      params.set("include_airlines", body.include_airlines);
    }

    if (body.exclude_airlines) {
      params.set("exclude_airlines", body.exclude_airlines);
    }

    params.set("api_key", process.env.SERPAPI_KEY);

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    console.log("🌍 SerpAPI URL:");
    console.log(url.replace(process.env.SERPAPI_KEY, "***"));

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SerpAPI request failed",
        status: response.status
      });
    }

    const data = await response.json();

    console.log(
      `✅ Returned ${
        (data.best_flights?.length || 0) +
        (data.other_flights?.length || 0)
      } flights`
    );

    if (data.error) {
      return res.status(500).json({
        error: "SerpAPI error",
        details: data.error
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);

    return res.status(500).json({
      error: "Server crashed",
      message: err.message
    });
  }
}
