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


            return results.map(
                (flight, index) => {

                    const segments =
                        flight.flights || [];


                    return {

                        id:
                            index,

                        /*
                        This is the TOTAL itinerary
                        price when the search is a
                        round-trip search.
                        */

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
                            "",

                        /*
                        Keep the original SERP object
                        available internally.

                        This is important because
                        Google Flights may expose
                        additional pricing/token
                        information here.
                        */

                        raw:
                            flight

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
        IMPORTANT

        The frontend should send the price shown
        on the selected departure card.

        Example:

        JFK -> YYZ = $466

        This is the selected round-trip
        itinerary starting price.
        */

        const selectedDeparturePrice =
            Number(
                body.departure_price || 0
            );



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

        A departure_token means the user selected
        a specific outbound flight.

        DO NOT decode the token.

        DO NOT independently search:

            YYZ -> JFK

        because that gives a ONE-WAY price.

        We keep the original round-trip route:

            JFK -> YYZ
            YYZ -> JFK

        and give Google Flights the selected
        departure_token.
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
                "🔥 SELECTED DEPARTURE TOKEN SEARCH"
            );

            console.log(
                "🔥 ========================================"
            );


            const tokenParams =
                new URLSearchParams();


            /*
            ORIGINAL OUTBOUND
            */

            tokenParams.set(
                "departure_id",
                origin
            );


            tokenParams.set(
                "arrival_id",
                destination
            );


            tokenParams.set(
                "outbound_date",
                departure_date
            );


            /*
            ORIGINAL RETURN DATE
            */

            tokenParams.set(
                "return_date",
                return_date
            );


            /*
            ROUND TRIP

            type=1 is round trip.
            */

            tokenParams.set(
                "type",
                "1"
            );


            /*
            SELECTED OUTBOUND

            This is what tells Google Flights
            which outbound was selected.
            */

            tokenParams.set(
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

                    departure_token:
                        "YES"

                }
            );


            try {

                const tokenData =
                    await serpSearch(
                        tokenParams
                    );


                console.log(
                    "🔥 TOKEN RESPONSE KEYS:",
                    Object.keys(
                        tokenData
                    )
                );


                const tokenRaw =
                    normalizeFlights(
                        tokenData
                    );


                console.log(
                    "🔥 TOKEN ROUNDTRIP RESULTS:",
                    tokenRaw.length
                );


                /*
                =================================================
                VERY IMPORTANT
                =================================================

                Every result returned from this search
                represents a complete itinerary:

                    selected outbound
                    +
                    a return flight

                Therefore flight.price is the TOTAL
                ROUND-TRIP price.

                We do NOT perform:

                    outbound price + return price

                We do NOT use an independent return
                search price.
                =================================================
                */


                if (
                    tokenRaw.length > 0
                ) {

                    const returnFlights =
                        tokenRaw.map(
                            (flight, index) => {

                                /*
                                Find the RETURN portion.

                                The token search result may
                                contain both legs.

                                We expose the complete
                                itinerary to the frontend,
                                but identify the return
                                direction separately.
                                */

                                const returnSegments =
                                    flight.flights.filter(
                                        segment => {

                                            const from =
                                                segment
                                                    .departure_airport
                                                    ?.id;

                                            const to =
                                                segment
                                                    .arrival_airport
                                                    ?.id;

                                            return (
                                                from ===
                                                destination &&
                                                to ===
                                                origin
                                            );

                                        }
                                    );


                                /*
                                If Google returned a
                                complete round trip,
                                use the total itinerary
                                price.

                                DO NOT replace this with
                                the return segment price.
                                */

                                const totalPrice =
                                    Number(
                                        flight.price || 0
                                    );


                                return {

                                    id:
                                        index,

                                    price:
                                        totalPrice,

                                    airline:
                                        returnSegments[0]
                                            ?.airline ||
                                        flight.airline,

                                    airline_logo:
                                        returnSegments[0]
                                            ?.airline_logo ||
                                        flight.airline_logo,

                                    duration:
                                        returnSegments.length
                                            ? returnSegments.reduce(
                                                (
                                                    total,
                                                    segment
                                                ) =>
                                                    total +
                                                    Number(
                                                        segment
                                                            .duration
                                                        || 0
                                                    ),
                                                0
                                            )
                                            : flight.duration,

                                    signature:
                                        flight.signature,

                                    departure_token:
                                        flight.departure_token,

                                    booking_token:
                                        flight.booking_token,

                                    /*
                                    Return only the
                                    RETURN segments to
                                    the frontend.

                                    This prevents the
                                    frontend from showing
                                    JFK -> YYZ again.
                                    */

                                    flights:
                                        returnSegments,

                                    /*
                                    Keep complete
                                    itinerary internally
                                    useful for debugging.
                                    */

                                    total_roundtrip_price:
                                        totalPrice

                                };

                            }
                        )
                        /*
                        Make sure only actual return
                        flights are displayed.
                        */

                        .filter(
                            flight =>
                                flight.flights.length > 0
                        );


                    /*
                    =================================================
                    SORT BY TOTAL ROUND-TRIP PRICE
                    =================================================
                    */

                    returnFlights.sort(
                        (a, b) =>
                            Number(a.price || 0) -
                            Number(b.price || 0)
                    );


                    console.log(
                        "🔥 FINAL ROUNDTRIP RETURN PRICES:"
                    );


                    console.log(
                        returnFlights.map(
                            flight => ({

                                airline:
                                    flight.airline,

                                total_roundtrip_price:
                                    flight.price,

                                return_route:
                                    flight.flights
                                        .map(
                                            segment =>

                                                segment
                                                    .departure_airport
                                                    ?.id +
                                                " -> " +
                                                segment
                                                    .arrival_airport
                                                    ?.id

                                        )
                                        .join(
                                            " | "
                                        )

                            })
                        )
                    );


                    return res.status(200).json({

                        departure:
                            [],

                        return:
                            returnFlights,

                        mode:
                            "return_by_departure_token",

                        selected_departure_price:
                            selectedDeparturePrice

                    });

                }

            }
            catch(tokenError) {

                console.error(
                    "🔥 TOKEN SEARCH FAILED:",
                    tokenError.message
                );

                console.log(
                    "⚠️ TOKEN SEARCH DID NOT RETURN A VALID ROUNDTRIP."
                );

            }

        }



        /*
        =========================================================
        STAGE 1
        INITIAL ROUND-TRIP SEARCH
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
            "🔥 INITIAL ROUNDTRIP SEARCH"
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
                        Because this is a round-trip
                        search, this is the COMPLETE
                        round-trip price.
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
        LOG DEPARTURE PRICES
        =========================================================
        */

        console.log(
            "🔥 DEPARTURE ROUNDTRIP PRICES:"
        );


        console.log(
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

        DO NOT perform an independent return search here.

        The initial search is responsible for producing
        the round-trip departure options.

        Once the customer selects one, the frontend
        sends its departure_token back to this endpoint.

        That token search is what produces the correct
        return combinations and TOTAL round-trip prices.
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
