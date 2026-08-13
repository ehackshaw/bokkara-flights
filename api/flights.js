export default async function handler(req, res) {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    if (req.method !== "POST") {
        return res.status(405).json({
            error: "POST only"
        });
    }


    try {

        const body = req.body || {};

        console.log(
            "🔥 REQUEST:",
            body
        );


        const adults =
            Number(body.adults || 1);


        /*
        =========================================================
        SERPAPI SEARCH
        =========================================================
        */

        async function serpSearch(params) {

            params.set(
                "engine",
                "google_flights"
            );

            params.set(
                "currency",
                "USD"
            );

            params.set(
                "hl",
                "en"
            );

            params.set(
                "gl",
                "us"
            );

            params.set(
                "adults",
                adults
            );

            params.set(
                "deep_search",
                "true"
            );

            params.set(
                "show_hidden",
                "true"
            );

            params.set(
                "sort_by",
                "2"
            );

            params.set(
                "api_key",
                process.env.SERPAPI_KEY
            );


            const url =
                "https://serpapi.com/search.json?" +
                params.toString();


            console.log(
                "SERP REQUEST:",
                url.replace(
                    process.env.SERPAPI_KEY,
                    "HIDDEN"
                )
            );


            const response =
                await fetch(url);


            const json =
                await response.json();


            console.log(
                "SERP STATUS:",
                response.status
            );


            if (!response.ok) {

                console.log(
                    "SERP ERROR:",
                    json
                );

                throw new Error(
                    "SerpAPI ERROR " +
                    response.status
                );

            }


            if (json.error) {

                console.log(
                    "SERP API ERROR:",
                    json.error
                );

                throw new Error(
                    json.error
                );

            }


            return json;

        }



        /*
        =========================================================
        CREATE SIGNATURE
        =========================================================
        */

        function createSignature(segments) {

            return segments
                .map(segment => {

                    return [
                        segment.departure_airport?.id || "",
                        segment.arrival_airport?.id || "",
                        segment.flight_number || ""
                    ].join("-");

                })
                .join("|");

        }



        /*
        =========================================================
        NORMALIZE FLIGHTS
        =========================================================
        */

        function normalizeFlights(data) {

            const results = [

                ...(data.best_flights || []),

                ...(data.other_flights || [])

            ];


            console.log(
                "🔥 TOTAL RAW SERP FLIGHTS:",
                results.length
            );


            return results.map((flight, index) => {

                const segments =
                    flight.flights || [];


                return {

                    id: index,

                    price:
                        flight.price || 0,

                    airline:
                        segments[0]?.airline ||
                        "Airline",

                    airline_logo:
                        segments[0]?.airline_logo ||
                        "",

                    duration:
                        flight.total_duration ||
                        0,

                    signature:
                        createSignature(
                            segments
                        ),

                    flights:
                        segments,

                    departure_token:
                        flight.departure_token ||
                        "",

                    booking_token:
                        flight.booking_token ||
                        ""

                };

            });

        }



        /*
        =========================================================
        REQUEST VALUES
        =========================================================
        */

        const origin =
            String(
                body.origin || ""
            )
            .trim()
            .toUpperCase();


        const destination =
            String(
                body.destination || ""
            )
            .trim()
            .toUpperCase();


        const departure_date =
            String(
                body.departure_date || ""
            ).trim();


        const return_date =
            String(
                body.return_date || ""
            ).trim();


        const departure_token =
            String(
                body.departure_token || ""
            ).trim();



        /*
        =========================================================
        VALIDATION
        =========================================================
        */

        if (
            !origin ||
            !destination ||
            !departure_date
        ) {

            return res.status(400).json({

                error:
                    "Missing flight fields"

            });

        }



        /*
        =========================================================
        STAGE 2
        SELECTED DEPARTURE
        =========================================================

        If departure_token exists, retrieve the RETURN
        flights associated with that exact outbound flight.

        IMPORTANT:

        We use the ORIGINAL route:

        origin      = POS
        destination = JFK

        NOT:

        origin      = JFK
        destination = POS

        The departure_token tells Google Flights which
        outbound flight was selected.
        =========================================================
        */

        if (departure_token) {

            if (!return_date) {

                return res.status(400).json({

                    error:
                        "Return date required for departure token search"

                });

            }


            console.log(
                "🔥 USING DEPARTURE TOKEN:",
                departure_token
            );


            const returnParams =
                new URLSearchParams();


            /*
            =====================================================
            ORIGINAL ROUND TRIP ROUTE
            =====================================================
            */

            returnParams.set(
                "departure_id",
                origin
            );


            returnParams.set(
                "arrival_id",
                destination
            );


            returnParams.set(
                "outbound_date",
                departure_date
            );


            returnParams.set(
                "return_date",
                return_date
            );


            returnParams.set(
                "type",
                "1"
            );


            /*
            =====================================================
            SELECTED OUTBOUND
            =====================================================
            */

            returnParams.set(
                "departure_token",
                departure_token
            );


            console.log(
                "🔥 RETURN TOKEN PARAMS:",
                {
                    departure_id: origin,
                    arrival_id: destination,
                    outbound_date: departure_date,
                    return_date: return_date,
                    type: "1",
                    has_departure_token: true
                }
            );


            const returnData =
                await serpSearch(
                    returnParams
                );


            console.log(
                "🔥 RETURN TOKEN RESPONSE KEYS:",
                Object.keys(returnData)
            );


            console.log(
                "🔥 RETURN TOKEN STATUS:",
                returnData.search_metadata?.status
            );


            const returnRaw =
                normalizeFlights(
                    returnData
                );


            console.log(
                "🔥 RETURN TOKEN FLIGHTS:",
                returnRaw.length
            );


            /*
            =====================================================
            RETURN RESULTS
            =====================================================
            */

            const returnFlights =
                returnRaw.map(
                    (flight, index) => {

                        return {

                            id: index,

                            /*
                            IMPORTANT:
                            This is the price returned by the
                            token search for the selected
                            outbound + return itinerary.
                            */

                            price:
                                flight.price,

                            airline:
                                flight.airline,

                            airline_logo:
                                flight.airline_logo,

                            duration:
                                flight.duration,

                            signature:
                                flight.signature,

                            departure_token:
                                flight.departure_token,

                            booking_token:
                                flight.booking_token,

                            flights:
                                flight.flights

                        };

                    }
                );


            console.log(
                "🔥 FINAL RETURN PRICES:",
                returnFlights.map(
                    flight => ({
                        airline:
                            flight.airline,

                        price:
                            flight.price,

                        signature:
                            flight.signature
                    })
                )
            );


            return res.status(200).json({

                departure: [],

                return:
                    returnFlights,

                mode:
                    "return_by_departure_token"

            });

        }



        /*
        =========================================================
        STAGE 1
        INITIAL ROUND TRIP SEARCH
        =========================================================
        */

        const departureParams =
            new URLSearchParams();


        departureParams.set(
            "departure_id",
            origin
        );


        departureParams.set(
            "arrival_id",
            destination
        );


        departureParams.set(
            "outbound_date",
            departure_date
        );


        /*
        =========================================================
        ROUND TRIP
        =========================================================
        */

        if (return_date) {

            departureParams.set(
                "return_date",
                return_date
            );

            departureParams.set(
                "type",
                "1"
            );

        } else {

            departureParams.set(
                "type",
                "2"
            );

        }


        console.log(
            "🔥 INITIAL ROUND TRIP SEARCH:",
            {
                origin,
                destination,
                departure_date,
                return_date
            }
        );


        const departureData =
            await serpSearch(
                departureParams
            );


        console.log(
            "🔥 DEPARTURE KEYS:",
            Object.keys(
                departureData
            )
        );


        const departureRaw =
            normalizeFlights(
                departureData
            );


        /*
        =========================================================
        DEPARTURE RESULTS
        =========================================================
        */

        const departureFlights =
            departureRaw.map(
                (flight, index) => {

                    return {

                        id: index,

                        price:
                            flight.price,

                        airline:
                            flight.airline,

                        airline_logo:
                            flight.airline_logo,

                        duration:
                            flight.duration,

                        signature:
                            flight.signature,

                        /*
                        IMPORTANT:
                        Keep this token.
                        */

                        departure_token:
                            flight.departure_token,

                        booking_token:
                            flight.booking_token,

                        flights:
                            flight.flights

                    };

                }
            );


        console.log(
            "🔥 DEPARTURE COUNT:",
            departureFlights.length
        );


        console.log(
            "🔥 DEPARTURE TOKENS:",
            departureFlights.map(
                flight => ({
                    airline:
                        flight.airline,

                    price:
                        flight.price,

                    token:
                        flight.departure_token
                            ? "YES"
                            : "NO"
                })
            )
        );


        /*
        =========================================================
        IMPORTANT
        =========================================================

        We DO NOT perform a second independent return search.

        Return flights are retrieved only after the user
        selects an outbound flight and supplies its
        departure_token.
        =========================================================
        */


        return res.status(200).json({

            departure:
                departureFlights,

            return:
                [],

            mode:
                return_date
                    ? "round_trip_initial"
                    : "one_way"

        });

    }


    catch(error) {

        console.error(
            "🔥 BACKEND ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Server crashed",

            message:
                error.message

        });

    }

}
