export default async function handler(req, res) {


    // CORS
    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    if(req.method === "OPTIONS"){

        return res.status(200).end();

    }



    try {


        const query = req.query.q;



        if(!query || query.length < 3){

            return res.status(200).json({

                suggestions:[]

            });

        }



        const apiKey = process.env.Maps_Platform_API_Key;



        if(!apiKey){

            return res.status(500).json({

                error:"Missing Google Maps API Key"

            });

        }



        const googleURL =
        "https://maps.googleapis.com/maps/api/place/autocomplete/json?"
        +
        new URLSearchParams({

            input: query,

            key: apiKey,

            types: "geocode|establishment",

            language:"en"

        });



        const response =
        await fetch(googleURL);



        const data =
        await response.json();



        console.log(
            "GOOGLE RESPONSE:",
            JSON.stringify(data)
        );



        if(data.status !== "OK"){


            return res.status(200).json({

                suggestions:[],

                status:data.status

            });


        }



        const suggestions =
        data.predictions.map(place=>({


            name:
            place.structured_formatting?.main_text
            ||
            place.description,



            description:
            place.structured_formatting?.secondary_text
            ||
            "",



            place_id:
            place.place_id,



            full:
            place.description



        }));



        return res.status(200).json({

            suggestions

        });



    } catch(error){


        console.error(
            "Google autocomplete error:",
            error
        );


        return res.status(500).json({

            error:"Server error"

        });


    }


}
