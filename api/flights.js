export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");


  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  if (req.method !== "POST") {
    return res.status(405).json({
      error:"POST only"
    });
  }


  try {

    const body = req.body || {};

    console.log("🔥 Incoming request:", body);



    function normalizeTrip(t){

      if(!t) return "oneway";

      t = String(t).toLowerCase();

      return t.includes("round")
        ? "roundtrip"
        : "oneway";

    }



    function normalizeInt(v,fallback=1){

      const n=parseInt(String(v).replace(/\D/g,""));

      return isNaN(n) || n<=0
        ? fallback
        : n;

    }



    function addDays(date,days){

      const d=new Date(date);

      d.setDate(d.getDate()+days);

      return d.toISOString().split("T")[0];

    }



    const origin =
      String(body.origin || "")
      .trim()
      .toUpperCase();



    const destination =
      String(body.destination || "")
      .trim()
      .toUpperCase();



    const departure_date = body.departure_date;

    const return_date = body.return_date;


    const type = normalizeTrip(body.type);

    const adults = normalizeInt(body.adults,1);



    if(!origin || !destination || !departure_date){

      return res.status(400).json({
        error:"Missing required fields",
        received:body
      });

    }




    async function searchFlights(date){


      const params = new URLSearchParams();



      params.set(
        "engine",
        "google_flights"
      );


      params.set(
        "departure_id",
        origin
      );


      params.set(
        "arrival_id",
        destination
      );


      params.set(
        "outbound_date",
        date
      );


      params.set(
        "currency",
        "USD"
      );


      params.set(
        "hl",
        "en"
      );


      params.set(
        "gl",
        "us"
      );


      params.set(
        "deep_search",
        "true"
      );


      params.set(
        "show_hidden",
        "true"
      );


      params.set(
        "sort_by",
        "2"
      );



      /*
        ROUND TRIP DATE FIX

        Keeps return date valid when
        flexible dates move departure.
      */

      if(type==="roundtrip"){


        params.set(
          "type",
          "1"
        );


        let adjustedReturn = return_date;



        if(
          adjustedReturn &&
          new Date(adjustedReturn) <= new Date(date)
        ){


          const newReturn =
            new Date(date);


          newReturn.setDate(
            newReturn.getDate() + 1
          );


          adjustedReturn =
            newReturn
            .toISOString()
            .split("T")[0];


        }



        params.set(
          "return_date",
          adjustedReturn
        );



      }else{


        params.set(
          "type",
          "2"
        );


      }



      params.set(
        "adults",
        adults
      );



      params.set(
        "api_key",
        process.env.SERPAPI_KEY
      );



      const url =
        `https://serpapi.com/search.json?${params.toString()}`;



      const response =
        await fetch(url);



      if(!response.ok){

        throw new Error(
          "SerpAPI failed: " + response.status
        );

      }



      return await response.json();


    }





    /*
       FLEXIBLE DATE SEARCH
    */


    if(body.flexible_dates === true){



      const calendar=[];


      const dates=[];



      for(
        let i=0;
        i<(body.days || 7);
        i++
      ){

        dates.push(
          addDays(
            departure_date,
            i
          )
        );

      }



      const searches =
        await Promise.all(
          dates.map(date =>
            searchFlights(date)
          )
        );




      searches.forEach(
        (result,index)=>{


          const flights = [

            ...(result.best_flights || []),

            ...(result.other_flights || []),

            ...(result.flights || [])

          ];



          flights.sort(
            (a,b)=>
              Number(a.price || 0) -
              Number(b.price || 0)
          );



          const cheapest =
            flights[0];



          let logo="";



          if(cheapest?.flights?.[0]){


            logo =
              cheapest.flights[0]
              .airline_logo || "";


          }



console.log("CALENDAR CHEAPEST:", cheapest);
          calendar.push({


            date:
              dates[index],


            price:
  cheapest
  ? (
      cheapest.price ??
      cheapest.total_price ??
      cheapest.amount ??
      cheapest?.price_details?.total ??
      null
    )
  : null,


            logo,


            flights


          });



        });


        const main =
          searches[0];



        return res.status(200).json({


          best_flights:
            main.best_flights || [],



          other_flights:
            main.other_flights || [],



          flights:
            [
              ...(main.best_flights || []),

              ...(main.other_flights || []),

              ...(main.flights || [])
            ],



          calendar



        });



    }

/*
   NORMAL SINGLE SEARCH
*/


/*
   ONE WAY
*/

if(type === "oneway"){


const data =
  await searchFlights(
    departure_date
  );


return res.status(200).json({

    departure_flights:[

        ...(data.best_flights || []),

        ...(data.other_flights || [])

    ],


    return_flights:[],


    flight_details:data,


    best_flights:
        data.best_flights || [],


    other_flights:
        data.other_flights || [],


    flights:[

        ...(data.best_flights || []),

        ...(data.other_flights || [])

    ]

});


}



/*
   ROUND TRIP
*/

if(type === "roundtrip"){



/*
   SEARCH DEPARTURE

   POS → JFK

*/

const departureData =
await searchFlights(
    departure_date
);





/*
   SEARCH RETURN

   JFK → POS

*/

const originalOrigin = origin;

const originalDestination = destination;


/*
   Swap airports
*/

const temp =
origin;


/*
   We cannot change const values,
   so create new search function
*/


async function searchReturnFlights(){


const params = new URLSearchParams();



params.set(
"engine",
"google_flights"
);



params.set(
"departure_id",
originalDestination
);



params.set(
"arrival_id",
originalOrigin
);



params.set(
"outbound_date",
return_date
);



params.set(
"currency",
"USD"
);



params.set(
"hl",
"en"
);



params.set(
"gl",
"us"
);



params.set(
"deep_search",
"true"
);



params.set(
"show_hidden",
"true"
);



params.set(
"sort_by",
"2"
);



params.set(
"type",
"1"
);



params.set(
"return_date",
departure_date
);



params.set(
"adults",
adults
);



params.set(
"api_key",
process.env.SERPAPI_KEY
);



const url =
`https://serpapi.com/search.json?${params.toString()}`;



const response =
await fetch(url);



if(!response.ok){

throw new Error(
"Return flight search failed"
);

}


return await response.json();


}





const returnData =
await searchReturnFlights();





return res.status(200).json({



departure_flights:[

    ...(departureData.best_flights || []),

    ...(departureData.other_flights || [])

],




return_flights:[

    ...(returnData.best_flights || []),

    ...(returnData.other_flights || [])

],




flight_details:{


departure:departureData,


return:returnData


},




/*
 keep old structure
 so nothing else breaks
*/


best_flights:

departureData.best_flights || [],



other_flights:

departureData.other_flights || [],



flights:[

    ...(departureData.best_flights || []),

    ...(departureData.other_flights || [])

]



});


}

  } catch(err){


    console.error(
      "🔥 SERVER ERROR:",
      err
    );



    return res.status(500).json({


      error:
        "Server crashed",


      message:
        err.message


    });


  }

}
