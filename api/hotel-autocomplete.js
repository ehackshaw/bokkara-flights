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
      "https://serpapi.com/search.json?" 
      + params.toString()
    );



    const data = await response.json();



    console.log(
      "FULL SERPAPI RESPONSE:",
      JSON.stringify(data)
    );



    let suggestions = [];



    /*
      Google Maps autocomplete response parser
    */


    if(Array.isArray(data.suggestions)){


      suggestions = data.suggestions.map(item=>({

        name:
        item.value ||
        item.name ||
        item.title ||
        item.text ||
        "",


        description:
        item.description ||
        item.subtitle ||
        "",


        type:
        item.type ||
        "place",


        id:
        item.place_id ||
        item.id ||
        ""


      }));

    }



    /*
      Backup if SerpAPI returns places
    */


    if(
      suggestions.length === 0 &&
      Array.isArray(data.places)
    ){


      suggestions = data.places.map(item=>({

        name:
        item.title ||
        item.name ||
        "",


        description:
        item.address ||
        item.location ||
        "",


        type:
        item.type ||
        "place",


        id:
        item.place_id ||
        ""

      }));


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(error);


    return res.status(500).json({

      error:"Server error"

    });


  }


}
