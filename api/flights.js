export default async function handler(req,res){


res.setHeader(
"Access-Control-Allow-Origin",
"*"
);


res.setHeader(
"Access-Control-Allow-Methods",
"POST, OPTIONS"
);


res.setHeader(
"Access-Control-Allow-Headers",
"Content-Type"
);



if(req.method==="OPTIONS"){

return res.status(200).end();

}



if(req.method!=="POST"){

return res.status(405).json({

error:"POST only"

});

}



try{


const body=req.body || {};



console.log(
"🔥 Incoming request:",
body
);



const origin =

String(body.origin || "")
.trim()
.toUpperCase();



const destination =

String(body.destination || "")
.trim()
.toUpperCase();



const departure_date =
body.departure_date;



const return_date =
body.return_date;



const adults =
parseInt(body.adults || 1);




if(
!origin ||
!destination ||
!departure_date
){

return res.status(400).json({

error:"Missing required fields",

received:body

});

}



/*
========================
SERPAPI GOOGLE FLIGHTS
========================
*/


async function searchFlights(){



const params =
new URLSearchParams();



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
departure_date
);



if(return_date){


params.set(
"return_date",
return_date
);


params.set(
"type",
"1"
);


}
else{


params.set(
"type",
"2"
);


}




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
"adults",
adults
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
"api_key",
process.env.SERPAPI_KEY
);





const url =

`https://serpapi.com/search.json?${params.toString()}`;



console.log(
"Searching:",
origin,
"→",
destination,
departure_date,
return_date
);



const response =
await fetch(url);



if(!response.ok){

throw new Error(
"SerpAPI error "+response.status
);

}



return await response.json();


}





/*
========================
FORMAT FLIGHTS
========================
*/


function formatFlight(flight){



const segments =

(flight.flights || []).map(segment=>({


airline:
segment.airline || "",


flight_number:
segment.flight_number || "",


aircraft:
segment.airplane || "",


from:
segment.departure_airport?.id || "",


to:
segment.arrival_airport?.id || "",


departure:
segment.departure_airport?.time || "",


arrival:
segment.arrival_airport?.time || "",


duration:
segment.duration || 0


}));





return {


id:
flight.departure_token || "",



airline:

flight.flights?.[0]?.airline ||

"Airline",



logo:

flight.airline_logo ||

"",



price:

flight.price || 0,



type:

flight.type || "Round trip",



duration:

flight.total_duration || 0,



stops:

segments.length > 1

?

`${segments.length-1} Stop`

:

"Nonstop",



segments

};


}





const flightData =
await searchFlights();




console.log(
"SERPAPI KEYS:",
Object.keys(flightData)
);





const rawFlights = [


...(flightData.best_flights || []),


...(flightData.other_flights || [])


];




console.log(
"TOTAL RAW FLIGHTS:",
rawFlights.length
);




const flights =

rawFlights.map(
formatFlight
);





/*
RETURN SAME DATA
BECAUSE GOOGLE FLIGHTS
ROUNDTRIP PRICE IS TOTAL
*/

return res.status(200).json({



departure:

flights,



return:

flights,



calendar:

[]



});



}
catch(error){


console.error(
"🔥 SERVER ERROR:",
error
);



return res.status(500).json({

error:"Server crashed",

message:error.message

});


}


}
