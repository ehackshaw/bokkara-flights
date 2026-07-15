export default async function handler(req, res) {


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



    if(!query || query.length < 2){

      return res.status(200).json({
        suggestions:[]
      });

    }



    const apiKey = process.env.SERPAPI_KEY;



    if(!apiKey){

      return res.status(500).json({
        error:"Missing SERPAPI_KEY"
      });

    }



    const params = new URLSearchParams({

      engine:"google_maps_autocomplete",

      q:query,

      api_key:apiKey

    });



    const response = await fetch(
      "https://serpapi.com/search.json?" +
      params.toString()
    );



    const data = await response.json();



    console.log(
      "SERPAPI RESPONSE:",
      JSON.stringify(data)
    );



    let suggestions = [];



    if(
      data.suggestions &&
      Array.isArray(data.suggestions)
    ){


      suggestions =
      data.suggestions.map(item=>{


        const place =
        item.data || item;



        return {


          name:

          place.title ||

          place.name ||

          place.value ||

          "",



          description:

          place.subtitle ||

          place.description ||

          place.address ||

          "",



          type:

          place.type ||

          "place",



          id:

          place.place_id ||

          ""

        };


      });


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(
      "AUTOCOMPLETE ERROR:",
      error
    );


    return res.status(500).json({

      error:"Server error"

    });


  }


}
