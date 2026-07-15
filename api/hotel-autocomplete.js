export default async function handler(req, res) {


  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );


  try {


    const params = new URLSearchParams({

      engine:"google_maps_autocomplete",

      q:req.query.q,

      hl:"en",

      gl:"us",

      ll:"@25.7617,-80.1918,10z",

      api_key:process.env.SERPAPI_KEY

    });



    const response = await fetch(
      "https://serpapi.com/search.json?" + params
    );



    const data = await response.json();



    return res.status(200).json({

      raw:data.suggestions

    });



  } catch(error){


    return res.status(500).json({

      error:error.message

    });


  }

}
