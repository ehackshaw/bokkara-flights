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
                "https://serpapi.com/search.json?"
                +
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
                        This is the actual price returned
                        by SerpAPI for THIS itinerary.
                        */

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


                        /*
                        VERY IMPORTANT
                        */

                        departure_token:
                            flight.departure_token ||
                            "",


                        booking_token:
                            flight.booking_token ||
                            "",


                        type:
                            flight.type ||
                            ""

                    };

                }
            );

        }


        /*
        =========================================================
        BASIC SEARCH PARAMETERS
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
        CHECK REQUIRED FIELDS
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
        =========================================================
        GET RETURN FLIGHTS FOR A SPECIFIC
        SELECTED DEPARTURE FLIGHT
        =========================================================

        The frontend sends:

        departure_token

        after the customer selects
        a specific outbound flight.
        =========================================================
        */

        const departureToken =
            String(
                body.departure_token || ""
            ).trim();


        if (
            departureToken &&
            return_date
        ) {

            console.log(
                "🔥 RETURN SEARCH FOR SELECTED DEPARTURE TOKEN"
            );


            console.log(
                "TOKEN:",
                departureToken
            );


            const returnParams =
                new URLSearchParams();


            /*
            IMPORTANT:
            SerpAPI requires the original
            round-trip route information
            together with the departure token.
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
            THIS IS THE CRITICAL PART
            */

            returnParams.set(
                "departure_token",
                departureToken
            );


            const returnData =
                await serpSearch(
                    returnParams
                );


            console.log(
                "🔥 RETURN TOKEN SEARCH KEYS:",
                Object.keys(returnData)
            );


            const returnRaw =
                normalizeFlights(
                    returnData
                );


            console.log(
                "🔥 RETURN FLIGHTS FOUND:",
                returnRaw.length
            );


            /*
            DO NOT MATCH PRICES TO AIRLINES.
            
            The price returned by SerpAPI
            belongs to the specific return
            itinerary returned by this token.
            */

            const returnFlights =
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
                "🔥 FINAL RETURN RESULTS:",
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

                mode:
                    "return",

                return:
                    returnFlights

            });

        }


        /*
        =========================================================
        MODE 1
        =========================================================
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
        Round trip search.
        This is important because SerpAPI
        gives each outbound itinerary
        its own departure_token.
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

        IMPORTANT:

        We preserve departure_token.

        The frontend will use this token
        when the user selects a departure.
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

                        flights:
                            flight.flights,

                        /*
                        CRITICAL
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


        console.log(
            "🔥 DEPARTURES:",
            departureFlights.length
        );


        console.log(
            "🔥 DEPARTURE TOKEN CHECK:",
            departureFlights.map(
                flight => ({

                    airline:
                        flight.airline,

                    price:
                        flight.price,

                    signature:
                        flight.signature,

                    has_departure_token:
                        !!flight.departure_token

                })
            )
        );


        /*
        =========================================================
        IMPORTANT
        =========================================================

        DO NOT perform a separate
        destination → origin search here.

        The return flights MUST be retrieved
        using the departure_token belonging
        to the selected outbound flight.

        Therefore initial return is empty.
        =========================================================
        */

        return res.status(200).json({

            mode:
                "departure",

            departure:
                departureFlights,

            return:
                []

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
