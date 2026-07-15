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


    if(!query || query.length < 2){

      return res.status(200).json({
        suggestions:[]
      });

    }



    const apiKey = process.env.SERPAPI_KEY;



    if(!apiKey){

      return res.status(500).json({
        error:"SERPAPI_KEY missing"
      });

    }



    const params = new URLSearchParams({

      engine:
      "google_maps_autocomplete",

      q:
      query,

      api_key:
      apiKey

    });



    const response = await fetch(
      "https://serpapi.com/search.json?" 
      + params.toString()
    );



    const data = await response.json();



    console.log(
      "MAP AUTOCOMPLETE:",
      JSON.stringify(data)
    );



    let suggestions = [];



    /*
      Google Maps autocomplete usually returns:
      suggestions
    */


    if(Array.isArray(data.suggestions)){


      suggestions =
      data.suggestions.map(item=>{


        return {

          name:
          item.value ||
          item.name ||
          item.title ||
          item.description ||
          "",


          description:
          item.description ||
          item.subtitle ||
          item.type ||
          "",


          type:
          item.type ||
          "place",


          id:
          item.place_id ||
          item.id ||
          ""


        };


      });


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(
      "Maps autocomplete error:",
      error
    );


    return res.status(500).json({

      error:
      "Server error"

    });


  }


}
