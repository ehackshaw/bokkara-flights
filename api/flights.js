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

            params.set(
                "show_hidden",
                "true"
            );

            params.set(
                "sort_by",
                "2"
            );

            /*
            Deep search for initial round-trip
            and token return searches.
            */

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


            return results.map(
                (flight, index) => {

                    const segments =
                        flight.flights || [];


                    const price =
                        Number(
                            flight.price || 0
                        );


                    return {

                        id: index,

                        price: price,

                        round_trip_price:
                            price,

                        airline:
                            segments[0]?.airline ||
                            "Airline",

                        airline_logo:
                            segments[0]?.airline_logo ||
                            flight.airline_logo ||
                            "",

                        duration:
                            flight.total_duration ||
                            flight.total_time_taken ||
                            0,

                        signature:
                            createSignature(
                                segments
                            ),

                        flights:
                            segments,

                        /*
                        IMPORTANT:
                        This token is what allows us
                        to retrieve the return flights.
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
            body.departure_date || "";


        const return_date =
            body.return_date || "";


        /*
        =========================================================
        SELECTED DEPARTURE TOKEN
        =========================================================
        */

        const selectedDepartureToken =
            String(
                body.departure_token || ""
            ).trim();


        /*
        =========================================================
        MODE 1
        SELECTED DEPARTURE → RETURN FLIGHTS
        =========================================================

        THIS MUST COME FIRST.

        A token request is different from the
        original search.
        =========================================================
        */

        if (selectedDepartureToken) {

            console.log(
                "🔥 MODE: SELECTED DEPARTURE RETURN SEARCH"
            );


            console.log(
                "🔥 DEPARTURE TOKEN RECEIVED:",
                selectedDepartureToken
            );


            /*
            =====================================================
            SERPAPI TOKEN REQUEST

            SerpApi documentation:

            departure_token is used to select a
            departure flight and retrieve the
            returning flights for a round trip.
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


            /*
            IMPORTANT:

            Do NOT send:

            departure_id
            arrival_id
            outbound_date

            because the departure_token already
            identifies the selected outbound itinerary.
            */


            const returnData =
                await serpSearch(
                    returnParams
                );


            console.log(
                "🔥 RETURN RESPONSE KEYS:",
                Object.keys(
                    returnData
                )
            );


            console.log(
                "🔥 RETURN BEST FLIGHTS:",
                (returnData.best_flights || []).length
            );


            console.log(
                "🔥 RETURN OTHER FLIGHTS:",
                (returnData.other_flights || []).length
            );


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
            =====================================================
            */

            const returnFlights =
                returnRaw.map(
                    (flight, index) => {

                        return {

                            id: index,

                            /*
                            SerpApi returns the price
                            associated with the selected
                            departure + return combination.
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

                            departure_token:
                                flight.departure_token,

                            type:
                                flight.type

                        };

                    }
                );


            /*
            =====================================================
            RETURN PRICE DEBUG
            =====================================================
            */

            console.log(
                "🔥 RETURN PRICE CHECK:",
                returnFlights
                    .slice(0, 10)
                    .map(flight => ({

                        airline:
                            flight.airline,

                        price:
                            flight.price,

                        round_trip_price:
                            flight.round_trip_price,

                        signature:
                            flight.signature,

                        has_booking_token:
                            !!flight.booking_token

                    }))
            );


            return res.status(200).json({

                departure: [],

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
        VALIDATE INITIAL SEARCH
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
        MODE 2
        INITIAL ROUND TRIP SEARCH
        =========================================================
        */

        if (return_date) {

            console.log(
                "🔥 MODE: INITIAL ROUND TRIP SEARCH"
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
            =====================================================
            INITIAL GOOGLE FLIGHTS ROUND TRIP SEARCH
            =====================================================
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
                            CRITICAL TOKEN
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

                        has_departure_token:
                            !!flight.departure_token

                    }))
            );


            /*
            =====================================================
            INITIAL RESPONSE

            We intentionally do NOT search JFK → POS
            here.

            Return flights will be requested after
            the customer selects a departure.
            =====================================================
            */

            return res.status(200).json({

                departure:
                    departureFlights,

                return: [],

                return_requires_selection:
                    true,

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

        console.log(
            "🔥 MODE: ONE WAY SEARCH"
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

                        departure_token:
                            flight.departure_token,

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

            return: [],

            return_requires_selection:
                false,

            pricing_mode:
                "one_way"

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
