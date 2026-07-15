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



    const params = new URLSearchParams({

      engine:"google_maps_autocomplete",

      q:query,

      hl:"en",

      gl:"us",

      ll:"@25.7617,-80.1918,10z",

      api_key:apiKey

    });



    const response = await fetch(
      "https://serpapi.com/search.json?" +
      params.toString()
    );



    const data = await response.json();



    let suggestions = [];



    if(
      Array.isArray(data.suggestions)
    ){


      suggestions =
      data.suggestions.map(item=>{


        return {


          name:
          item.value || "",



          description:
          item.subtext || "",



          type:
          item.type || "place",



          latitude:
          item.latitude || "",



          longitude:
          item.longitude || "",



          id:
          item.data_id || ""

        };


      });


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(
      "Autocomplete Error:",
      error
    );


    return res.status(500).json({

      error:"Server error"

    });


  }


}
