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
            String(adults)
        );

        /*
        IMPORTANT:

        deep_search should only be used for
        round-trip searches.
        */

        if (
            params.get("type") === "1"
        ) {

            params.set(
                "deep_search",
                "true"
            );

        }

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
                "SERPAPI RETURNED ERROR:",
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
    CREATE FLIGHT SIGNATURE
    =========================================================
    */

    function createSignature(segments) {

        if (!Array.isArray(segments)) {
            return "";
        }

        return segments.map(segment => {

            return [

                segment.departure_airport?.id || "",

                segment.arrival_airport?.id || "",

                segment.flight_number || ""

            ].join("-");

        }).join("|");

    }


    /*
    =========================================================
    NORMALIZE SERPAPI FLIGHTS
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


        return results.map(
            (flight, index) => {

                const segments =
                    flight.flights || [];


                return {

                    id: index,

                    /*
                    IMPORTANT:

                    For a round-trip search this is
                    the round-trip ticket price.
                    */

                    price:
                        Number(
                            flight.price || 0
                        ),


                    /*
                    Explicit copy so the frontend
                    knows this is the round-trip price.
                    */

                    round_trip_price:
                        Number(
                            flight.price || 0
                        ),


                    airline:
                        segments[0]?.airline ||
                        "Airline",


                    airline_logo:
                        segments[0]?.airline_logo ||
                        flight.airline_logo ||
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


                    /*
                    THIS IS THE IMPORTANT PART.
                    */

                    departure_token:
                        flight.departure_token ||
                        null,


                    booking_token:
                        flight.booking_token ||
                        null,


                    type:
                        flight.type ||
                        ""

                };

            }
        );

    }


    /*
    =========================================================
    BASIC REQUEST VALUES
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
        body.departure_date;


    const return_date =
        body.return_date;


    /*
    =========================================================
    SELECTED DEPARTURE TOKEN
    =========================================================

    When the user selects a departure flight,
    the frontend will send this token back.

    If this exists, we DO NOT perform another
    JFK → POS one-way search.

    We retrieve the actual return options
    belonging to the selected departure.
    =========================================================
    */

    const selectedDepartureToken =
        String(
            body.departure_token || ""
        ).trim();


    /*
    =========================================================
    VALIDATE
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
    MODE 1
    INITIAL ROUND-TRIP SEARCH
    =========================================================
    */

    if (
        return_date &&
        !selectedDepartureToken
    ) {

        console.log(
            "🔥 MODE:",
            "INITIAL ROUND TRIP SEARCH"
        );


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


        departureParams.set(
            "return_date",
            return_date
        );


        departureParams.set(
            "type",
            "1"
        );


        /*
        Google Flights round-trip search.
        */

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
        =====================================================
        DEPARTURE RESULTS
        =====================================================
        */

        const departureFlights =
            departureRaw.map(
                (flight, index) => {

                    return {

                        id: index,

                        price:
                            flight.price,


                        /*
                        Explicit round-trip price.
                        */

                        round_trip_price:
                            flight.round_trip_price,


                        airline:
                            flight.airline,


                        airline_logo:
                            flight.airline_logo,


                        duration:
                            flight.duration,


                        signature:
                            flight.signature,


                        flights:
                            flight.flights,


                        /*
                        FRONTEND NEEDS THIS
                        WHEN USER SELECTS THE FLIGHT.
                        */

                        departure_token:
                            flight.departure_token,


                        booking_token:
                            flight.booking_token,


                        type:
                            flight.type

                    };

                }
            );


        /*
        =====================================================
        LOG TOKEN AVAILABILITY
        =====================================================
        */

        const tokenCount =
            departureFlights.filter(
                flight =>
                    !!flight.departure_token
            ).length;


        console.log(
            "🔥 DEPARTURE COUNT:",
            departureFlights.length
        );


        console.log(
            "🔥 DEPARTURE TOKENS:",
            tokenCount
        );


        console.log(
            "🔥 PRICE CHECK:",
            departureFlights
                .slice(0, 5)
                .map(flight => ({

                    airline:
                        flight.airline,

                    price:
                        flight.price,

                    round_trip_price:
                        flight.round_trip_price,

                    signature:
                        flight.signature,

                    has_departure_token:
                        !!flight.departure_token

                }))
        );


        /*
        =====================================================
        IMPORTANT

        We intentionally DO NOT perform a separate
        one-way return search here.

        The return flights are retrieved only after
        the user selects a departure.
        =====================================================
        */

        return res.status(200).json({

            departure:
                departureFlights,


            return:
                [],


            /*
            Tell frontend that it must select a
            departure before returns are loaded.
            */

            return_requires_selection:
                true,


            pricing_mode:
                "google_round_trip_departure_token"

        });

    }


    /*
    =========================================================
    MODE 2
    GET RETURNS FOR SELECTED DEPARTURE
    =========================================================
    */

    if (
        return_date &&
        selectedDepartureToken
    ) {

        console.log(
            "🔥 MODE:",
            "SELECTED DEPARTURE RETURN SEARCH"
        );


        console.log(
            "🔥 USING DEPARTURE TOKEN"
        );


        /*
        =====================================================
        SERPAPI RETURN REQUEST

        This is the critical difference.

        We are NOT doing:

        JFK → POS type=2

        We are doing:

        departure_token = selected departure

        This tells Google Flights which exact
        outbound itinerary the customer selected.
        =====================================================
        */

        const returnParams =
            new URLSearchParams();


        returnParams.set(
            "type",
            "1"
        );


        returnParams.set(
            "departure_token",
            selectedDepartureToken
        );


        returnParams.set(
            "return_date",
            return_date
        );


        const returnData =
            await serpSearch(
                returnParams
            );


        console.log(
            "🔥 RETURN KEYS:",
            Object.keys(
                returnData
            )
        );


        /*
        =====================================================
        NORMALIZE RETURN RESULTS
        =====================================================
        */

        const returnRaw =
            normalizeFlights(
                returnData
            );


        console.log(
            "🔥 RETURN COUNT:",
            returnRaw.length
        );


        /*
        =====================================================
        RETURN RESULTS

        IMPORTANT:

        We do NOT replace the price.

        We do NOT match by airline.

        We do NOT use departureRaw[0].

        We use the actual price returned by
        Google Flights for this selected departure
        + each return option.
        =====================================================
        */

        const returnFlights =
            returnRaw.map(
                (flight, index) => {

                    return {

                        id: index,


                        /*
                        THIS IS NOW THE ACTUAL
                        ROUND-TRIP PRICE.
                        */

                        price:
                            flight.price,


                        round_trip_price:
                            flight.round_trip_price,


                        airline:
                            flight.airline,


                        airline_logo:
                            flight.airline_logo,


                        duration:
                            flight.duration,


                        signature:
                            flight.signature,


                        flights:
                            flight.flights,


                        booking_token:
                            flight.booking_token,


                        type:
                            flight.type

                    };

                }
            );


        /*
        =====================================================
        LOG RETURN PRICING
        =====================================================
        */

        console.log(
            "🔥 RETURN PRICE CHECK:",
            returnFlights.map(
                flight => ({

                    airline:
                        flight.airline,

                    price:
                        flight.price,

                    round_trip_price:
                        flight.round_trip_price,

                    signature:
                        flight.signature

                })
            )
        );


        return res.status(200).json({

            departure:
                [],


            return:
                returnFlights,


            return_requires_selection:
                false,


            pricing_mode:
                "google_round_trip_departure_token"

        });

    }


    /*
    =========================================================
    MODE 3
    ONE-WAY SEARCH
    =========================================================
    */

    if (
        !return_date &&
        !selectedDepartureToken
    ) {

        console.log(
            "🔥 MODE:",
            "ONE WAY SEARCH"
        );


        const oneWayParams =
            new URLSearchParams();


        oneWayParams.set(
            "departure_id",
            origin
        );


        oneWayParams.set(
            "arrival_id",
            destination
        );


        oneWayParams.set(
            "outbound_date",
            departure_date
        );


        oneWayParams.set(
            "type",
            "2"
        );


        const oneWayData =
            await serpSearch(
                oneWayParams
            );


        console.log(
            "🔥 ONE WAY KEYS:",
            Object.keys(
                oneWayData
            )
        );


        const oneWayRaw =
            normalizeFlights(
                oneWayData
            );


        const oneWayFlights =
            oneWayRaw.map(
                (flight, index) => {

                    return {

                        id: index,

                        price:
                            flight.price,


                        round_trip_price:
                            null,


                        airline:
                            flight.airline,


                        airline_logo:
                            flight.airline_logo,


                        duration:
                            flight.duration,


                        signature:
                            flight.signature,


                        flights:
                            flight.flights,


                        booking_token:
                            flight.booking_token,


                        type:
                            flight.type

                    };

                }
            );


        console.log(
            "🔥 ONE WAY COUNT:",
            oneWayFlights.length
        );


        return res.status(200).json({

            departure:
                oneWayFlights,


            return:
                [],


            return_requires_selection:
                false,


            pricing_mode:
                "one_way"

        });

    }


    /*
    =========================================================
    INVALID MODE
    =========================================================
    */

    return res.status(400).json({

        error:
            "Invalid flight search request"

    });

}


catch (error) {

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
