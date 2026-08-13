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


            return json;

        }



        /*
        =========================================================
        CREATE FLIGHT SIGNATURE
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
                        createSignature(segments),

                    flights:
                        segments,

                    /*
                    =================================================
                    IMPORTANT
                    =================================================
                    Keep the departure token.
                    This token identifies this exact outbound
                    itinerary and is required to retrieve its
                    compatible return flights.
                    =================================================
                    */

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
            body.departure_date;


        const return_date =
            body.return_date;


        const departure_token =
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
        STAGE 2
        =========================================================

        If a departure_token is supplied, the user has already
        selected an outbound flight.

        We now ask Google Flights for the compatible return
        flights for THAT EXACT outbound flight.

        =========================================================
        */

        if (departure_token) {

            console.log(
                "🔥 RETURN SEARCH USING DEPARTURE TOKEN"
            );


            const returnParams =
                new URLSearchParams();


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


            if (return_date) {

                returnParams.set(
                    "return_date",
                    return_date
                );

            }


            returnParams.set(
                "type",
                "1"
            );


            /*
            =====================================================
            THIS IS THE IMPORTANT PART
            =====================================================
            */

            returnParams.set(
                "departure_token",
                departure_token
            );


            const returnData =
                await serpSearch(
                    returnParams
                );


            console.log(
                "🔥 TOKEN RETURN KEYS:",
                Object.keys(returnData)
            );


            const returnRaw =
                normalizeFlights(
                    returnData
                );


            /*
            =====================================================
            RETURN PRICE IS NOW THE ACTUAL ROUND-TRIP PRICE
            =====================================================

            SerpAPI returns the price associated with the
            selected outbound + return itinerary.

            We do NOT copy the outbound price.
            We do NOT search the return route independently.
            We do NOT match by airline.
            =====================================================
            */


            const returnFlights =
                returnRaw.map((flight, index) => {

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

                });


            console.log(
                "🔥 TOKEN RETURN COUNT:",
                returnFlights.length
            );


            console.log(
                "🔥 CORRECT ROUND TRIP PRICES:",
                returnFlights.map(
                    flight => ({
                        airline:
                            flight.airline,

                        price:
                            flight.price
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
        =========================================================

        Initial round-trip search.

        DO NOT perform a separate return search here.

        Google Flights returns outbound flights with a
        departure_token.

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


        if (return_date) {

            departureParams.set(
                "return_date",
                return_date
            );

        }


        /*
        =========================================================
        ROUND TRIP
        =========================================================
        */

        departureParams.set(
            "type",
            return_date
                ? "1"
                : "2"
        );



        const departureData =
            await serpSearch(
                departureParams
            );


        console.log(
            "🔥 DEPARTURE KEYS:",
            Object.keys(departureData)
        );


        const departureRaw =
            normalizeFlights(
                departureData
            );


        /*
        =========================================================
        DEPARTURE FLIGHTS
        =========================================================

        IMPORTANT:
        Keep departure_token in every flight.

        The frontend will send this token back after the
        customer selects a departure.
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



        /*
        =========================================================
        IMPORTANT
        =========================================================

        We intentionally DO NOT do this anymore:

        JFK → POS

        as a separate search.

        That was the source of the incorrect return pricing.

        =========================================================
        */


        console.log(
            "🔥 DEPARTURES:",
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
