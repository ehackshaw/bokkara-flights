export default async function handler(req, res) {


  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );


  try {


    const query = req.query.q;


    const apiKey = process.env.SERPAPI_KEY;



    const params = new URLSearchParams({

      engine:"google_maps_autocomplete",

      q:query,

      hl:"en",

      gl:"us",

      api_key:apiKey

    });



    const url =
    "https://serpapi.com/search.json?" +
    params.toString();



    const response = await fetch(url);



    const data = await response.json();



    console.log(
      JSON.stringify(data,null,2)
    );



    return res.status(200).json(data);



  } catch(error){


    return res.status(500).json({

      error:error.message

    });


  }


}
