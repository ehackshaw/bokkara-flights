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
            Math.max(
                1,
                Number(body.adults || 1)
            );


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
            )
            .trim();


        const return_date =
            String(
                body.return_date || ""
            )
            .trim();


        const departure_token =
            String(
                body.departure_token || ""
            )
            .trim();


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
                error: "Missing flight fields"
            });

        }


        /*
        =========================================================
        SERPAPI
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
                "🔥 SERP REQUEST:",
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
                "🔥 SERP STATUS:",
                response.status
            );


            if (!response.ok) {

                console.error(
                    "🔥 SERP HTTP ERROR:",
                    json
                );

                throw new Error(
                    "SerpAPI ERROR " +
                    response.status
                );

            }


            if (json.error) {

                console.error(
                    "🔥 SERP API ERROR:",
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
        SIGNATURE
        =========================================================
        */

        function createSignature(
            segments
        ) {

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
        NORMALIZE
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

                        price:
                            Number(
                                flight.price || 0
                            ),

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

                }
            );

        }



        /*
        =========================================================
        STAGE 2
        SELECTED OUTBOUND
        =========================================================

        THIS IS THE IMPORTANT PART.

        When the user selects JFK -> YYZ:

        departure_token belongs to that exact
        outbound flight.

        We send that token back to Google Flights
        using the ORIGINAL JFK -> YYZ round-trip
        search.

        We DO NOT:

        YYZ -> JFK independently

        because that produces one-way prices.
        =========================================================
        */

        if (
            departure_token &&
            return_date
        ) {

            console.log(
                "🔥 ========================================"
            );

            console.log(
                "🔥 SELECTED OUTBOUND TOKEN SEARCH"
            );

            console.log(
                "🔥 ========================================"
            );


            const params =
                new URLSearchParams();


            /*
            ORIGINAL ROUTE
            */

            params.set(
                "departure_id",
                origin
            );


            params.set(
                "arrival_id",
                destination
            );


            /*
            ORIGINAL OUTBOUND DATE
            */

            params.set(
                "outbound_date",
                departure_date
            );


            /*
            RETURN DATE
            */

            params.set(
                "return_date",
                return_date
            );


            /*
            ROUND TRIP
            */

            params.set(
                "type",
                "1"
            );


            /*
            SELECTED OUTBOUND
            */

            params.set(
                "departure_token",
                departure_token
            );


            console.log(
                "🔥 TOKEN SEARCH PARAMS:",
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

                    token:
                        departure_token
                            ? "YES"
                            : "NO"
                }
            );


            let tokenData;


            try {

                tokenData =
                    await serpSearch(
                        params
                    );

            }
            catch(error) {

                console.error(
                    "🔥 TOKEN SEARCH FAILED:",
                    error.message
                );


                return res.status(200).json({

                    departure: [],

                    return: [],

                    mode:
                        "return_token_failed",

                    error:
                        "Unable to retrieve return flights for this departure.",

                    message:
                        error.message

                });

            }



            console.log(
                "🔥 TOKEN RESPONSE KEYS:",
                Object.keys(tokenData)
            );


            console.log(
                "🔥 TOKEN SEARCH PARAMETERS:",
                tokenData.search_parameters
            );


            /*
            =====================================================
            GOOGLE FLIGHTS RESULTS
            =====================================================
            */

            const tokenFlights =
                normalizeFlights(
                    tokenData
                );


            console.log(
                "🔥 TOKEN FLIGHT COUNT:",
                tokenFlights.length
            );


            /*
            =====================================================
            IMPORTANT PRICE LOGGING
            =====================================================
            */

            console.log(
                "🔥 TOKEN ROUNDTRIP PRICES:",
                tokenFlights.map(
                    flight => ({

                        airline:
                            flight.airline,

                        price:
                            flight.price,

                        signature:
                            flight.signature,

                        segments:
                            flight.flights?.map(
                                segment => ({
                                    from:
                                        segment.departure_airport?.id,

                                    to:
                                        segment.arrival_airport?.id,

                                    flight:
                                        segment.flight_number
                                })
                            )

                    })
                )
            );



            /*
            =====================================================
            FILTER ONLY RETURN OPTIONS
            =====================================================

            The selected outbound is already locked by
            departure_token.

            Therefore the flights returned by Google
            represent the available combinations for
            that selected outbound.

            We expose their COMPLETE itinerary price.

            We do NOT replace the price with a separate
            one-way return price.
            =====================================================
            */

            const returnFlights =
                tokenFlights.map(
                    (flight, index) => {

                        return {

                            id:
                                index,

                            /*
                            THIS MUST REMAIN THE COMPLETE
                            ROUND-TRIP PRICE.
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



            /*
            =====================================================
            IF GOOGLE RETURNED NOTHING
            =====================================================
            */

            if (
                returnFlights.length === 0
            ) {

                console.error(
                    "🔥 NO RETURN COMBINATIONS FROM GOOGLE"
                );


                return res.status(200).json({

                    departure: [],

                    return: [],

                    mode:
                        "no_return_combinations",

                    error:
                        "No return flights found for this departure."

                });

            }



            console.log(
                "🔥 ========================================"
            );

            console.log(
                "🔥 FINAL RETURN RESULTS"
            );

            console.log(
                "🔥 ========================================"
            );


            console.log(
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
                    "return_by_selected_departure"

            });

        }



        /*
        =========================================================
        STAGE 1
        INITIAL SEARCH
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

        }
        else {

            departureParams.set(
                "type",
                "2"
            );

        }


        console.log(
            "🔥 ========================================"
        );

        console.log(
            "🔥 INITIAL FLIGHT SEARCH"
        );

        console.log(
            "🔥 ========================================"
        );


        console.log({

            origin,

            destination,

            departure_date,

            return_date

        });


        const departureData =
            await serpSearch(
                departureParams
            );


        console.log(
            "🔥 DEPARTURE RESPONSE KEYS:",
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

                        id:
                            index,

                        /*
                        For the initial round-trip
                        search this is already the
                        complete round-trip price.
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


        /*
        =========================================================
        LOG INITIAL PRICES
        =========================================================
        */

        console.log(
            "🔥 DEPARTURE ROUNDTRIP PRICES:",
            departureFlights.map(
                flight => ({

                    airline:
                        flight.airline,

                    price:
                        flight.price,

                    token:
                        flight.departure_token
                            ? "YES"
                            : "NO",

                    signature:
                        flight.signature

                })
            )
        );


        console.log(
            "🔥 DEPARTURE COUNT:",
            departureFlights.length
        );



        /*
        =========================================================
        IMPORTANT
        =========================================================

        DO NOT RUN:

        YYZ -> JFK

        here.

        That would return the standalone
        one-way price ($235).

        The return search happens only after
        a departure is selected and the
        departure_token is sent back.
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
