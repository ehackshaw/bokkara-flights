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

    const origin = (body.origin || "").toUpperCase();
    const destination = (body.destination || "").toUpperCase();
    const departure_date = body.departure_date;
    const return_date = body.return_date;
    const type = body.type || "oneway";

    if (!origin || !destination || !departure_date) {
      return res.status(400).json({
        error: "Missing fields",
        received: body
      });
    }

    // Build SerpAPI params
    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departure_date,
      type: type === "roundtrip" ? "1" : "2",
      api_key: process.env.SERPAPI_KEY
    });

    // Add return date if roundtrip
    if (type === "roundtrip" && return_date) {
      params.append("return_date", return_date);
    }

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    console.log("🌍 SerpAPI URL:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("📦 SerpAPI RESPONSE:", JSON.stringify(data, null, 2));

    if (data.error) {
      return res.status(500).json({
        error: "SerpAPI error",
        details: data.error
      });
    }

    // 🚨 IMPORTANT: Return RAW SerpAPI response (no transformation)
    return res.status(200).json(data);

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);

    return res.status(500).json({
      error: "Server crashed",
      message: err.message
    });
  }
}
