export default async function handler(req, res) {
  try {
    const { origin, destination, departure_date, return_date } = req.body || {};

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

    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json({
      debug_url: url,
      full_response: data
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
