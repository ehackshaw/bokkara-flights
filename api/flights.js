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
"🔥 REQUEST:",
body
);



const adults =
Number(body.adults || 1);



async function serpSearch(params){



params.set(
"engine",
"google_flights"
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
"adults",
adults
);


params.set(
"deep_search",
"true"
);



params.set(
"api_key",
process.env.SERPAPI_KEY
);



const url =
"https://serpapi.com/search.json?"
+
params.toString();



console.log(
"SERP:",
url.replace(
process.env.SERPAPI_KEY,
"HIDDEN"
)
);



const response =
await fetch(url);



const json =
await response.json();



console.log(
"SERP STATUS:",
response.status
);



if(!response.ok){

console.log(json);

throw new Error(
"SerpAPI ERROR "+response.status
);

}



return json;


}







function normalizeFlights(data){



const results = [

...(data.best_flights || []),

...(data.other_flights || [])

];



return results.map(flight=>{



const first =
flight.flights?.[0] || {};



return {


price:
flight.price || 0,



/*
IMPORTANT:
Google Flights token location
*/

departure_token:

flight.departure_token ||

flight.departure_token_id ||

"",



airline:

first.airline ||

flight.airline ||

"Airline",



airline_logo:

first.airline_logo ||

flight.airline_logo ||

"",



departure_airport:{


id:

first.departure_airport?.id ||

"",


time:

first.departure_airport?.time ||

""

},



arrival_airport:{


id:

first.arrival_airport?.id ||

"",


time:

first.arrival_airport?.time ||

""

},



duration:

flight.total_duration ||

0,



flights:

flight.flights || []

};



});


}









/*
================================
SECOND SEARCH
RETURN FLIGHTS
================================
*/


if(body.departure_token){



console.log(
"🔁 RETURN SEARCH"
);



console.log(
"TOKEN:",
body.departure_token
);



const params =
new URLSearchParams();



params.set(
"departure_token",
body.departure_token
);



const returnData =
await serpSearch(params);



console.log(
"RETURN KEYS:",
Object.keys(returnData)
);



const returns =
normalizeFlights(returnData);



console.log(
"RETURN COUNT:",
returns.length
);



return res.status(200).json({

return:returns

});


}









/*
================================
FIRST SEARCH
DEPARTURE FLIGHTS
================================
*/


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



if(
!origin ||
!destination ||
!departure_date
){

return res.status(400).json({

error:"Missing flight fields"

});

}




const params =
new URLSearchParams();



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





const departureData =
await serpSearch(params);



console.log(
"DEPARTURE KEYS:",
Object.keys(departureData)
);



const departures =
normalizeFlights(departureData);



console.log(
"DEPARTURE COUNT:",
departures.length
);



return res.status(200).json({

departure:departures,

return:[]

});



}



catch(error){



console.error(
"🔥 BACKEND ERROR:",
error
);



return res.status(500).json({

error:"Server crashed",

message:error.message

});


}


}
