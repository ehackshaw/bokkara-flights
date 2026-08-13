export default async function handler(req, res) {

    /*
    =========================================================
    CORS
    =========================================================
    */

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


        /*
        =========================================================
        BASIC INPUT
        =========================================================
        */

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


        const selectedDepartureToken =
            String(
                body.departure_token || ""
            )
                .trim();


        /*
        =========================================================
        SELECTED DEPARTURE PRICE

        The frontend can send the price of the selected
        outbound flight when requesting return flights.

        This lets us guarantee that every return card uses
        the SAME full round-trip price.
        =========================================================
        */

        const requestedRoundTripPrice =
            Number(
                body.round_trip_price ||
                body.selected_round_trip_price ||
                0
            );


        console.log(
            "🔥 INPUT ROUND TRIP PRICE:",
            requestedRoundTripPrice
        );


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


            params.set(
                "show_hidden",
                "true"
            );


            params.set(
                "sort_by",
                "2"
            );


            params.set(
                "deep_search",
                "true"
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

                console.log(
                    "🔥 SERP ERROR:",
                    json
                );


                throw new Error(
                    "SerpAPI ERROR " +
                    response.status
                );

            }


            if (json.error) {

                console.log(
                    "🔥 SERPAPI ERROR:",
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

        function createSignature(segments) {

            if (!Array.isArray(segments)) {
                return "";
            }


            return segments
                .map(
                    segment => {

                        return [

                            segment
                                ?.departure_airport
                                ?.id || "",

                            segment
                                ?.arrival_airport
                                ?.id || "",

                            segment
                                ?.flight_number || ""

                        ].join("-");

                    }
                )
                .join("|");

        }


        /*
        =========================================================
        GET RAW FLIGHT ARRAYS
        =========================================================
        */

        function collectFlightResults(data) {

            const results = [];


            if (
                Array.isArray(
                    data?.best_flights
                )
            ) {

                results.push(
                    ...data.best_flights
                );

            }


            if (
                Array.isArray(
                    data?.other_flights
                )
            ) {

                results.push(
                    ...data.other_flights
                );

            }


            if (
                Array.isArray(
                    data?.return_flights
                )
            ) {

                results.push(
                    ...data.return_flights
                );

            }


            if (
                Array.isArray(
                    data?.flights
                )
            ) {

                results.push(
                    ...data.flights
                );

            }


            return results;

        }


        /*
        =========================================================
        NORMALIZE FLIGHT
        =========================================================
        */

        function normalizeFlight(
            flight,
            index,
            forcedRoundTripPrice = null
        ) {

            const segments =
                Array.isArray(
                    flight?.flights
                )
                    ? flight.flights
                    : [];


            const apiPrice =
                Number(
                    flight?.price || 0
                );


            /*
            IMPORTANT:

            If a forced round-trip price exists,
            use that instead of the price returned
            by the return continuation.
            */

            const finalRoundTripPrice =
                Number(
                    forcedRoundTripPrice
                ) > 0
                    ? Number(
                        forcedRoundTripPrice
                    )
                    : apiPrice;


            return {

                id:
                    index,


                /*
                Original API price.
                */

                price:
                    apiPrice,


                /*
                The price the frontend should use
                for the complete round trip.
                */

                round_trip_price:
                    finalRoundTripPrice,


                total_round_trip_price:
                    finalRoundTripPrice,


                airline:
                    segments[0]?.airline ||
                    flight?.airline ||
                    "Airline",


                airline_logo:
                    segments[0]?.airline_logo ||
                    flight?.airline_logo ||
                    "",


                duration:
                    Number(
                        flight?.total_duration ||
                        0
                    ),


                signature:
                    createSignature(
                        segments
                    ),


                flights:
                    segments,


                departure_token:
                    flight?.departure_token ||
                    null,


                booking_token:
                    flight?.booking_token ||
                    null,


                type:
                    flight?.type ||
                    "",


                /*
                Preserve useful SerpAPI data.
                */

                extensions:
                    Array.isArray(
                        flight?.extensions
                    )
                        ? flight.extensions
                        : [],


                carbon_emissions:
                    flight?.carbon_emissions ||
                    null,


                ticket_also_sold_by:
                    Array.isArray(
                        flight?.ticket_also_sold_by
                    )
                        ? flight.ticket_also_sold_by
                        : [],


                /*
                Debug information.
                */

                _serp_index:
                    index,

                _api_price:
                    apiPrice

            };

        }


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
        MODE 1
        INITIAL ROUND TRIP SEARCH
        =========================================================

        Search:

        POS → PTY
        outbound date
        return date

        Google Flights gives us outbound flights
        containing individual departure_tokens.

        We DO NOT attempt to retrieve return flights
        until the user selects an outbound.
        =========================================================
        */

        if (
            return_date &&
            !selectedDepartureToken
        ) {

            console.log(
                "🔥 MODE: INITIAL ROUND TRIP SEARCH"
            );


            const params =
                new URLSearchParams();


            params.set(
                "departure_id",
                origin
            );


            params.set(
                "arrival_id",
                destination
            );


            params.set(
                "outbound_date",
                departure_date
            );


            params.set(
                "return_date",
                return_date
            );


            params.set(
                "type",
                "1"
            );


            const data =
                await serpSearch(
                    params
                );


            console.log(
                "🔥 INITIAL RESPONSE KEYS:",
                Object.keys(data)
            );


            console.log(
                "🔥 INITIAL best_flights:",
                data.best_flights?.length || 0
            );


            console.log(
                "🔥 INITIAL other_flights:",
                data.other_flights?.length || 0
            );


            /*
            =====================================================
            COLLECT INITIAL RESULTS
            =====================================================
            */

            const rawFlights =
                collectFlightResults(
                    data
                );


            console.log(
                "🔥 INITIAL TOTAL RAW:",
                rawFlights.length
            );


            /*
            =====================================================
            NORMALIZE

            IMPORTANT:

            flight.price here is the Google Flights
            round-trip ticket price for the selected
            outbound option.

            We preserve it as round_trip_price.
            =====================================================
            */

            const departureFlights =
                rawFlights.map(
                    (
                        flight,
                        index
                    ) =>
                        normalizeFlight(
                            flight,
                            index,
                            Number(
                                flight?.price || 0
                            )
                        )
                );


            /*
            =====================================================
            TOKEN DEBUG
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
                "🔥 FIRST DEPARTURE TOKEN:",
                departureFlights[0]
                    ?.departure_token
                    ? "YES"
                    : "NO"
            );


            /*
            =====================================================
            PRICE DEBUG
            =====================================================
            */

            console.log(
                "🔥 INITIAL PRICES:",
                departureFlights
                    .slice(0, 10)
                    .map(
                        flight => ({

                            airline:
                                flight.airline,

                            price:
                                flight.price,

                            round_trip_price:
                                flight.round_trip_price,

                            token:
                                flight.departure_token
                                    ? "YES"
                                    : "NO"

                        })
                    )
            );


            /*
            =====================================================
            RETURN EMPTY

            Frontend must select outbound first.
            =====================================================
            */

            return res.status(200).json({

                departure:
                    departureFlights,

                return:
                    [],

                return_requires_selection:
                    true,

                pricing_mode:
                    "google_round_trip",

                trip_type:
                    "round_trip",

                origin:
                    origin,

                destination:
                    destination,

                departure_date:
                    departure_date,

                return_date:
                    return_date

            });

        }


        /*
        =========================================================
        MODE 2
        SELECTED DEPARTURE

        The frontend sends:

        departure_token
        round_trip_price

        We use the departure_token to ask Google Flights
        for the return options associated with that
        EXACT outbound flight.

        SerpApi documents departure_token as the mechanism
        for retrieving returning flights. 
        =========================================================
        */

        if (
            return_date &&
            selectedDepartureToken
        ) {

            console.log(
                "🔥🔥 MODE: SELECTED DEPARTURE"
            );


            console.log(
                "🔥🔥 TOKEN LENGTH:",
                selectedDepartureToken.length
            );


            console.log(
                "🔥🔥 TOKEN START:",
                selectedDepartureToken.substring(
                    0,
                    100
                )
            );


            /*
            =====================================================
            PRICE RULE

            If frontend supplied the selected outbound's
            round-trip price, use it.

            Otherwise we attempt to recover the price from
            the continuation response.
            =====================================================
            */

            let selectedPrice =
                requestedRoundTripPrice > 0
                    ? requestedRoundTripPrice
                    : null;


            /*
            =====================================================
            SERPAPI TOKEN REQUEST
            =====================================================
            */

            const params =
                new URLSearchParams();


            params.set(
                "departure_token",
                selectedDepartureToken
            );


            params.set(
                "type",
                "1"
            );


            const data =
                await serpSearch(
                    params
                );


            /*
            =====================================================
            RESPONSE DEBUG
            =====================================================
            */

            console.log(
                "🔥🔥 RETURN RESPONSE KEYS:",
                Object.keys(data)
            );


            console.log(
                "🔥🔥 RETURN best_flights:",
                data.best_flights?.length || 0
            );


            console.log(
                "🔥🔥 RETURN other_flights:",
                data.other_flights?.length || 0
            );


            console.log(
                "🔥🔥 RETURN return_flights:",
                data.return_flights?.length || 0
            );


            console.log(
                "🔥🔥 RETURN flights:",
                data.flights?.length || 0
            );


            /*
            =====================================================
            COLLECT RETURN FLIGHTS
            =====================================================
            */

            const returnRaw =
                collectFlightResults(
                    data
                );


            console.log(
                "🔥🔥 TOTAL RETURN RAW:",
                returnRaw.length
            );


            /*
            =====================================================
            IF THE FRONTEND DID NOT SEND THE PRICE

            Try to recover it from the continuation response.

            The first returned result may contain the complete
            round-trip fare.
            =====================================================
            */

            if (
                !selectedPrice &&
                returnRaw.length > 0
            ) {

                const possiblePrice =
                    Number(
                        returnRaw[0]?.price || 0
                    );


                if (
                    possiblePrice > 0
                ) {

                    selectedPrice =
                        possiblePrice;

                }

            }


            console.log(
                "🔥🔥 FINAL SELECTED ROUND TRIP PRICE:",
                selectedPrice
            );


            /*
            =====================================================
            NO RETURN RESULTS
            =====================================================
            */

            if (
                returnRaw.length === 0
            ) {

                console.log(
                    "🔥🔥🔥 NO RETURN FLIGHTS FOUND"
                );


                console.log(
                    "🔥🔥 FULL RETURN RESPONSE:",
                    JSON.stringify(
                        data,
                        null,
                        2
                    )
                );


                return res.status(200).json({

                    departure:
                        [],

                    return:
                        [],

                    return_requires_selection:
                        false,

                    pricing_mode:
                        "google_round_trip",

                    selected_round_trip_price:
                        selectedPrice,

                    debug: {

                        message:
                            "SerpAPI returned no recognizable return flight array",

                        response_keys:
                            Object.keys(data),

                        return_counts: {

                            best_flights:
                                data.best_flights?.length ||
                                0,

                            other_flights:
                                data.other_flights?.length ||
                                0,

                            return_flights:
                                data.return_flights?.length ||
                                0,

                            flights:
                                data.flights?.length ||
                                0

                        }

                    }

                });

            }


            /*
            =====================================================
            NORMALIZE RETURN FLIGHTS

            CRITICAL:

            Every return flight gets the SAME
            selected_round_trip_price.

            We do NOT use the return flight's own
            price as the displayed round-trip price.
            =====================================================
            */

            const returnFlights =
                returnRaw.map(
                    (
                        flight,
                        index
                    ) =>
                        normalizeFlight(
                            flight,
                            index,
                            selectedPrice
                        )
                );


            /*
            =====================================================
            RETURN PRICE DEBUG
            =====================================================
            */

            console.log(
                "🔥🔥 FINAL RETURN PRICES:",
                returnFlights
                    .slice(0, 20)
                    .map(
                        flight => ({

                            airline:
                                flight.airline,

                            api_price:
                                flight.price,

                            round_trip_price:
                                flight.round_trip_price,

                            total_round_trip_price:
                                flight.total_round_trip_price,

                            signature:
                                flight.signature

                        })
                    )
            );


            /*
            =====================================================
            RETURN RESPONSE
            =====================================================
            */

            return res.status(200).json({

                departure:
                    [],

                return:
                    returnFlights,

                return_requires_selection:
                    false,

                pricing_mode:
                    "google_round_trip",

                /*
                This is the price of the selected
                outbound + return combination.
                */

                selected_round_trip_price:
                    selectedPrice,

                /*
                Keep the selected token available
                for debugging / frontend use.
                */

                selected_departure_token:
                    selectedDepartureToken,

                origin:
                    origin,

                destination:
                    destination,

                departure_date:
                    departure_date,

                return_date:
                    return_date

            });

        }


        /*
        =========================================================
        MODE 3
        ONE WAY
        =========================================================
        */

        if (
            !return_date &&
            !selectedDepartureToken
        ) {

            console.log(
                "🔥 MODE: ONE WAY SEARCH"
            );


            const params =
                new URLSearchParams();


            params.set(
                "departure_id",
                origin
            );


            params.set(
                "arrival_id",
                destination
            );


            params.set(
                "outbound_date",
                departure_date
            );


            params.set(
                "type",
                "2"
            );


            const data =
                await serpSearch(
                    params
                );


            const rawFlights =
                collectFlightResults(
                    data
                );


            const flights =
                rawFlights.map(
                    (
                        flight,
                        index
                    ) =>
                        normalizeFlight(
                            flight,
                            index,
                            null
                        )
                );


            /*
            ONE-WAY FLIGHTS SHOULD NOT
            HAVE A ROUND-TRIP PRICE.
            */

            const oneWayFlights =
                flights.map(
                    flight => ({

                        ...flight,

                        round_trip_price:
                            null,

                        total_round_trip_price:
                            null

                    })
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
                    "one_way",

                trip_type:
                    "one_way"

            });

        }


        /*
        =========================================================
        INVALID REQUEST
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
                error?.message ||
                "Unknown server error"

        });

    }

}
