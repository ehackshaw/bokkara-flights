export default async function handler(req, res) {

  // Allow Shopify frontend requests
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


  // Handle preflight request
  if(req.method === "OPTIONS"){
    return res.status(200).end();
  }


  try {


    const query = req.query.q;


    if(!query){

      return res.status(400).json({
        error:"Missing search query"
      });

    }



    const apiKey = process.env.SERPAPI_KEY;



    if(!apiKey){

      return res.status(500).json({
        error:"SerpAPI key missing"
      });

    }



    const url =
    "https://serpapi.com/search.json?" +
    new URLSearchParams({

      engine:
      "google_hotels_autocomplete",

      q:
      query,

      api_key:
      apiKey

    });



    const response =
    await fetch(url);



    const data =
    await response.json();



    /*
       Convert SerpAPI response
       into a clean format
    */

    let suggestions = [];



    if(data.suggestions){


      suggestions =
      data.suggestions.map(item => ({


        name:
        item.name ||
        item.title ||
        "",


        description:
        item.description ||
        item.subtitle ||
        "",


        type:
        item.type ||
        "place",


        id:
        item.id ||
        ""


      }));


    }



    return res.status(200).json({

      suggestions

    });



  } catch(error){


    console.error(
      "Hotel autocomplete error:",
      error
    );


    return res.status(500).json({

      error:
      "Server error"

    });


  }


}
