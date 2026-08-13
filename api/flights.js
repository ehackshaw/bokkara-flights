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
        SELECTED DEPARTURE TOKEN
        =========================================================

        The token must belong to the CURRENT search.

        We therefore do NOT blindly trust a token sent from
        the browser.

        First we decode the token enough to determine whether
        it references the current route/date.

        If it does not match the current search, we IGNORE it
        and perform a normal return search instead.
        =========================================================
        */

        let tokenIsValidForCurrentSearch = false;


        if (
            departure_token &&
            return_date
        ) {

            try {

                const decoded =
                    Buffer.from(
                        departure_token,
                        "base64"
                    ).toString("utf8");


                console.log(
                    "🔥 TOKEN DECODED:",
                    decoded
                );


                /*
                Google Flights tokens are not intended
                as a permanent database format.

                We only use this check as a safety mechanism.

                The token must contain the current route
                somewhere in its decoded representation.
                */

                const decodedUpper =
                    decoded.toUpperCase();


                const routeMatches =
                    decodedUpper.includes(origin) &&
                    decodedUpper.includes(destination);


                const departureDateMatches =
                    decodedUpper.includes(
                        departure_date
                    );


                if (
                    routeMatches &&
                    departureDateMatches
                ) {

                    tokenIsValidForCurrentSearch =
                        true;

                }

            }
            catch(tokenError) {

                console.log(
                    "⚠️ TOKEN COULD NOT BE DECODED"
                );

            }

        }



        console.log(
            "🔥 TOKEN VALID FOR CURRENT SEARCH:",
            tokenIsValidForCurrentSearch
        );



        /*
        =========================================================
        TOKEN SEARCH
        =========================================================
        */

        if (
            departure_token &&
            return_date &&
            tokenIsValidForCurrentSearch
        ) {

            console.log(
                "🔥 USING CURRENT DEPARTURE TOKEN"
            );


            const returnParams =
                new URLSearchParams();


            /*
            IMPORTANT:

            For Google Flights departure-token searches,
            retain the original round-trip route.

            The token identifies the selected outbound.
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


            returnParams.set(
                "departure_token",
                departure_token
            );


            console.log(
                "🔥 RETURN TOKEN PARAMS:",
                {
                    departure_id:
                        origin,

                    arrival_id:
                        destination,

                    outbound_date:
                        departure_date,

                    return_date:
                        return_date,

                    type:
                        "1",

                    has_departure_token:
                        true
                }
            );


            try {

                const returnData =
                    await serpSearch(
                        returnParams
                    );


                console.log(
                    "🔥 RETURN TOKEN RESPONSE KEYS:",
                    Object.keys(
                        returnData
                    )
                );


                const returnRaw =
                    normalizeFlights(
                        returnData
                    );


                console.log(
                    "🔥 RETURN TOKEN FLIGHTS:",
                    returnRaw.length
                );


                if (returnRaw.length > 0) {

                    const returnFlights =
                        returnRaw.map(
                            (flight, index) => {

                                return {

                                    id: index,

                                    /*
                                    IMPORTANT:

                                    Use the price returned by
                                    Google Flights for this
                                    selected outbound +
                                    return combination.
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
                        "🔥 FINAL TOKEN RETURN PRICES:",
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

            }
            catch(tokenSearchError) {

                console.log(
                    "⚠️ TOKEN SEARCH FAILED:"
                );

                console.log(
                    tokenSearchError.message
                );

                console.log(
                    "⚠️ FALLING BACK TO NORMAL RETURN SEARCH"
                );

            }

        }
        else if (departure_token) {

            console.log(
                "⚠️ STALE OR INVALID DEPARTURE TOKEN"
            );

            console.log(
                "⚠️ TOKEN WILL NOT BE USED"
            );

        }



        /*
        =========================================================
        STAGE 1
        INITIAL DEPARTURE SEARCH
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
        INITIAL SEARCH
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

        }
        else {

            departureParams.set(
                "type",
                "2"
            );

        }


        console.log(
            "🔥 INITIAL FLIGHT SEARCH:",
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
        FALLBACK RETURN SEARCH
        =========================================================

        If we don't have a valid departure token, search
        the return direction independently.

        IMPORTANT:

        We do NOT use the old departure token.

        We search:

        destination -> origin

        using return_date.
        =========================================================
        */

        let returnFlights = [];


        if (return_date) {

            const fallbackReturnParams =
                new URLSearchParams();


            fallbackReturnParams.set(
                "departure_id",
                destination
            );


            fallbackReturnParams.set(
                "arrival_id",
                origin
            );


            fallbackReturnParams.set(
                "outbound_date",
                return_date
            );


            fallbackReturnParams.set(
                "type",
                "2"
            );


            console.log(
                "🔥 FALLBACK RETURN SEARCH:",
                {
                    departure_id:
                        destination,

                    arrival_id:
                        origin,

                    outbound_date:
                        return_date,

                    type:
                        "2"
                }
            );


            try {

                const fallbackReturnData =
                    await serpSearch(
                        fallbackReturnParams
                    );


                console.log(
                    "🔥 FALLBACK RETURN KEYS:",
                    Object.keys(
                        fallbackReturnData
                    )
                );


                const returnRaw =
                    normalizeFlights(
                        fallbackReturnData
                    );


                console.log(
                    "🔥 FALLBACK RETURN COUNT:",
                    returnRaw.length
                );


                /*
                IMPORTANT:

                DO NOT match return prices against
                departure flights.

                The return search has its own prices.
                */

                returnFlights =
                    returnRaw.map(
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
                    "🔥 FALLBACK RETURN PRICES:",
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

            }
            catch(returnError) {

                console.error(
                    "🔥 FALLBACK RETURN SEARCH ERROR:",
                    returnError.message
                );

                /*
                Do not crash the entire departure search.

                Return the departure results and an empty
                return array so the frontend can handle it.
                */

                returnFlights = [];

            }

        }



        /*
        =========================================================
        FINAL RESPONSE
        =========================================================
        */

        console.log(
            "🔥 FINAL RESULT:",
            {

                departures:
                    departureFlights.length,

                returns:
                    returnFlights.length

            }
        );


        return res.status(200).json({

            departure:
                departureFlights,

            return:
                returnFlights,

            mode:
                return_date
                    ? "round_trip"
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
