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

        const origin =
            String(body.origin || "")
                .trim()
                .toUpperCase();

        const destination =
            String(body.destination || "")
                .trim()
                .toUpperCase();

        const departure_date =
            String(body.departure_date || "");

        const return_date =
            String(body.return_date || "");

        const selectedDepartureToken =
            String(
                body.departure_token || ""
            ).trim();


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

            return segments.map(
                segment => {

                    return [

                        segment.departure_airport?.id || "",

                        segment.arrival_airport?.id || "",

                        segment.flight_number || ""

                    ].join("-");

                }
            ).join("|");

        }


        /*
        =========================================================
        NORMALIZE INITIAL FLIGHTS
        =========================================================
        */

        function normalizeInitialFlights(data) {

            const best =
                Array.isArray(data.best_flights)
                    ? data.best_flights
                    : [];

            const other =
                Array.isArray(data.other_flights)
                    ? data.other_flights
                    : [];


            const results = [
                ...best,
                ...other
            ];


            console.log(
                "🔥 INITIAL best_flights:",
                best.length
            );

            console.log(
                "🔥 INITIAL other_flights:",
                other.length
            );

            console.log(
                "🔥 INITIAL TOTAL:",
                results.length
            );


            return results.map(
                (flight, index) => {

                    const segments =
                        Array.isArray(flight.flights)
                            ? flight.flights
                            : [];


                    return {

                        id: index,

                        price:
                            Number(
                                flight.price || 0
                            ),

                        round_trip_price:
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
                            Number(
                                flight.total_duration || 0
                            ),

                        signature:
                            createSignature(
                                segments
                            ),

                        flights:
                            segments,

                        departure_token:
                            flight.departure_token ||
                            null,

                        booking_token:
                            flight.booking_token ||
                            null,

                        type:
                            flight.type ||
                            "",

                        /*
                        KEEP THE ORIGINAL
                        SERP OBJECT.

                        This is extremely important
                        for debugging and future use.
                        */

                        _serp_index:
                            index

                    };

                }
            );

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
        INITIAL ROUND TRIP
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

            params.set(
                "deep_search",
                "true"
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
            NORMALIZE
            =====================================================
            */

            const departureFlights =
                normalizeInitialFlights(
                    data
                );


            /*
            =====================================================
            TOKEN CHECK
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


            /*
            =====================================================
            TOKEN DEBUG
            =====================================================
            */

            console.log(
                "🔥 FIRST DEPARTURE TOKEN:",
                departureFlights[0]
                    ?.departure_token
                    ? "YES"
                    : "NO"
            );


            console.log(
                "🔥 FIRST DEPARTURE:",
                JSON.stringify(
                    departureFlights[0],
                    null,
                    2
                )
            );


            /*
            =====================================================
            RETURN EMPTY FOR NOW

            Frontend MUST select an outbound.

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
                    "google_round_trip"

            });

        }


        /*
        =========================================================
        MODE 2
        SELECTED DEPARTURE
        =========================================================
        */

        if (
            return_date &&
            selectedDepartureToken
        ) {

            console.log(
                "🔥🔥🔥 MODE: SELECTED DEPARTURE"
            );


            console.log(
                "🔥 TOKEN LENGTH:",
                selectedDepartureToken.length
            );


            console.log(
                "🔥 TOKEN START:",
                selectedDepartureToken.substring(
                    0,
                    80
                )
            );


            /*
            =====================================================
            IMPORTANT

            For a departure token continuation request,
            do NOT send another normal outbound search.

            The token identifies the selected outbound.
            =====================================================
            */

            const params =
                new URLSearchParams();


            params.set(
                "engine",
                "google_flights"
            );


            params.set(
                "departure_token",
                selectedDepartureToken
            );


            params.set(
                "type",
                "1"
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
                "api_key",
                process.env.SERPAPI_KEY
            );


            const url =
                "https://serpapi.com/search.json?" +
                params.toString();


            console.log(
                "🔥🔥 RETURN TOKEN REQUEST:",
                url.replace(
                    process.env.SERPAPI_KEY,
                    "HIDDEN"
                )
            );


            const response =
                await fetch(url);


            const data =
                await response.json();


            console.log(
                "🔥🔥 RETURN STATUS:",
                response.status
            );


            if (!response.ok) {

                console.log(
                    "🔥🔥 RETURN ERROR:",
                    data
                );

                throw new Error(
                    "Return SerpAPI ERROR " +
                    response.status
                );

            }


            if (data.error) {

                console.log(
                    "🔥🔥 RETURN SERP ERROR:",
                    data.error
                );

                throw new Error(
                    data.error
                );

            }


            /*
            =====================================================
            THIS IS THE MOST IMPORTANT DEBUG
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
                "🔥🔥 RETURN airports:",
                data.airports
                    ? "YES"
                    : "NO"
            );


            /*
            =====================================================
            GOOGLE FLIGHTS MAY RETURN FLIGHTS IN
            OTHER STRUCTURES DURING TOKEN CONTINUATION.

            CHECK EVERYTHING.
            =====================================================
            */

            const possibleArrays = [

                {
                    name:
                        "best_flights",

                    value:
                        data.best_flights
                },

                {
                    name:
                        "other_flights",

                    value:
                        data.other_flights
                },

                {
                    name:
                        "flights",

                    value:
                        data.flights
                },

                {
                    name:
                        "return_flights",

                    value:
                        data.return_flights
                }

            ];


            possibleArrays.forEach(
                item => {

                    console.log(
                        "🔥 RETURN ARRAY:",
                        item.name,
                        Array.isArray(item.value)
                            ? item.value.length
                            : "NOT ARRAY"
                    );

                }
            );


            /*
            =====================================================
            COLLECT RETURN RESULTS
            =====================================================
            */

            let returnRaw = [];


            if (
                Array.isArray(
                    data.best_flights
                )
            ) {

                returnRaw.push(
                    ...data.best_flights
                );

            }


            if (
                Array.isArray(
                    data.other_flights
                )
            ) {

                returnRaw.push(
                    ...data.other_flights
                );

            }


            if (
                Array.isArray(
                    data.return_flights
                )
            ) {

                returnRaw.push(
                    ...data.return_flights
                );

            }


            if (
                Array.isArray(
                    data.flights
                )
            ) {

                returnRaw.push(
                    ...data.flights
                );

            }


            console.log(
                "🔥🔥 TOTAL RETURN RAW:",
                returnRaw.length
            );


            /*
            =====================================================
            IF NOTHING CAME BACK

            DUMP THE RESPONSE STRUCTURE.
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

                    debug: {

                        message:
                            "SerpAPI returned no recognizable return flight array",

                        response_keys:
                            Object.keys(data)

                    }

                });

            }


            /*
            =====================================================
            NORMALIZE RETURN FLIGHTS
            =====================================================
            */

            const returnFlights =
                returnRaw.map(
                    (flight, index) => {

                        /*
                        Some continuation responses
                        may contain nested flight objects.
                        */

                        const segments =
                            Array.isArray(
                                flight.flights
                            )
                                ? flight.flights
                                : [];


                        return {

                            id:
                                index,

                            price:
                                Number(
                                    flight.price || 0
                                ),

                            round_trip_price:
                                Number(
                                    flight.price || 0
                                ),

                            airline:
                                segments[0]?.airline ||
                                flight.airline ||
                                "Airline",

                            airline_logo:
                                segments[0]?.airline_logo ||
                                flight.airline_logo ||
                                "",

                            duration:
                                Number(
                                    flight.total_duration ||
                                    0
                                ),

                            signature:
                                createSignature(
                                    segments
                                ),

                            flights:
                                segments,

                            booking_token:
                                flight.booking_token ||
                                null,

                            departure_token:
                                flight.departure_token ||
                                null,

                            type:
                                flight.type ||
                                ""

                        };

                    }
                );


            console.log(
                "🔥🔥 FINAL RETURN COUNT:",
                returnFlights.length
            );


            console.log(
                "🔥🔥 RETURN PRICE CHECK:",
                returnFlights
                    .slice(0, 10)
                    .map(
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
                    "google_round_trip"

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


            const flights =
                normalizeInitialFlights(
                    data
                );


            const oneWayFlights =
                flights.map(
                    flight => ({

                        ...flight,

                        round_trip_price:
                            null

                    })
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
