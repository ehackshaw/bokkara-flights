export default async function handler(req, res) {


  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );


  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );


  if(req.method === "OPTIONS"){
    return res.status(200).end();
  }



  try {


    const query = req.query.q;


    if(!query){

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



    console.log(
      JSON.stringify(data,null,2)
    );



    let suggestions=[];



    if(Array.isArray(data.suggestions)){


      suggestions =
      data.suggestions.map(item=>{


        const place =
        item.data || item;



        return {

          name:
          place.title ||
          place.name ||
          "",


          description:
          place.subtitle ||
          place.description ||
          "",


          id:
          place.place_id ||
          "",


          type:
          place.type ||
          "place"

        };


      });


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(error);


    return res.status(500).json({

      error:error.message

    });


  }


}
