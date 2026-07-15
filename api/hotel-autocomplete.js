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

            // ONLY locations
            types: "geocode",

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



        /*
            Keep only:

            - Countries
            - Cities
            - States
            - Provinces
            - Regions

        */

        const allowedTypes = [

            "country",

            "locality",

            "administrative_area_level_1",

            "administrative_area_level_2",

            "administrative_area_level_3",

            "postal_town",

            "sublocality"

        ];



        const suggestions =

        data.predictions

        .filter(place => {


            const placeTypes =
            place.types || [];



            return placeTypes.some(type =>
                allowedTypes.includes(type)
            );


        })


        .map(place=>({


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



            types:

            place.types,



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
