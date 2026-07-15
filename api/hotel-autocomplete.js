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
        error:"SERPAPI_KEY not found"
      });

    }



    const params = new URLSearchParams({

      engine:"google_hotels_autocomplete",

      q:query,

      api_key:apiKey

    });



    const response = await fetch(
      "https://serpapi.com/search.json?" + params
    );



    const data = await response.json();



    console.log(
      "SERPAPI DATA:",
      JSON.stringify(data)
    );



    let suggestions = [];



    if(Array.isArray(data.suggestions)){


      suggestions = data.suggestions.map(item => ({


        name:
        item.name ||
        item.title ||
        item.text ||
        item.value ||
        "",


        description:
        item.description ||
        item.subtitle ||
        item.location ||
        "",


        type:
        item.type ||
        "place",


        id:
        item.id ||
        item.place_id ||
        ""


      }));


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(
      "Hotel autocomplete failed:",
      error
    );


    return res.status(500).json({

      error:"Server error"

    });


  }


}
