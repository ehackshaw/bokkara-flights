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

    // =========================
    // NORMALIZERS (FIXED INPUTS)
    // =========================

    const normalizeTrip = (t) => {
      if (!t) return "oneway";
      t = String(t).toLowerCase();
      if (t.includes("round")) return "roundtrip";
      return "oneway";
    };

    const normalizeInt = (v, fallback = 1) => {
      const n = parseInt(String(v).replace(/\D/g, ""));
      return isNaN(n) || n <= 0 ? fallback : n;
    };

    const normalizeStops = (s) => {
      if (s === null || s === undefined) return null;

      s = String(s).toLowerCase();

      if (s.includes("non") || s === "0") return 0;
      if (s.includes("1")) return 1;

      return null;
    };

    // =========================
    // CLEAN INPUTS
    // =========================

    const origin = String(body.origin || "").trim().toUpperCase();
    const destination = String(body.destination || "").trim().toUpperCase();
    const departure_date = body.departure_date;
    const return_date = body.return_date;

    const type = normalizeTrip(body.type);
    const stops = normalizeStops(body.max_stops);
    const adults = normalizeInt(body.adults, 1);

    // =========================
    // VALIDATION
    // =========================

    if (!origin || !destination || !departure_date) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body
      });
    }

    const params = new URLSearchParams();

    params.set("engine", "google_flights");
    params.set("departure_id", origin);
    params.set("arrival_id", destination);
    params.set("outbound_date", departure_date);
    params.set("currency", "USD");
    params.set("hl", "en");
    params.set("gl", "us");

    params.set("deep_search", "true");
    params.set("show_hidden", "true");
    params.set("sort_by", "2");

    // =========================
    // TRIP TYPE FIX
    // =========================

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

    // =========================
    // STOPS FIX
    // =========================

    if (stops !== null) {
      params.set("stops", stops);
    }

    // =========================
    // PASSENGERS FIX
    // =========================

    params.set("adults", adults);

    // optional extras (safe)
    if (body.children) params.set("children", normalizeInt(body.children, 0));
    if (body.travel_class) params.set("travel_class", body.travel_class);
    if (body.max_price) params.set("max_price", body.max_price);
    if (body.include_airlines) params.set("include_airlines", body.include_airlines);
    if (body.exclude_airlines) params.set("exclude_airlines", body.exclude_airlines);

    params.set("api_key", process.env.SERPAPI_KEY);

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    console.log("🌍 SerpAPI URL (hidden key)");

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
