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
"SERP REQUEST:",
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







function getAllFlights(data){

return [

...(data.best_flights || []),

...(data.other_flights || [])

];

}







function splitRoundTripFlight(
flight,
origin,
destination
){


const segments =
flight.flights || [];



let outbound = [];

let inbound = [];



segments.forEach(segment=>{


const from =
segment.departure_airport?.id;


const to =
segment.arrival_airport?.id;



// outbound POS -> PTY

if(
from === origin
){

outbound.push(segment);

}


// return PTY -> POS

else if(
from === destination
){

inbound.push(segment);

}


});



return {

outbound,

inbound

};


}








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








/*
====================================
GOOGLE FLIGHTS ROUND TRIP SEARCH
====================================
*/


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

}



params.set(
"type",
return_date ? "1" : "2"
);






const data =
await serpSearch(params);




console.log(
"🔥 BEST FLIGHT SAMPLE:",
data.best_flights?.[0]
);



console.log(
"🔥 OTHER FLIGHT SAMPLE:",
data.other_flights?.[0]
);




const rawFlights =
getAllFlights(data);




console.log(
"🔥 TOTAL RAW SERP FLIGHTS:",
rawFlights.length
);






let departureFlights = [];

let returnFlights = [];






rawFlights.forEach(
(flight,index)=>{



const split =
splitRoundTripFlight(
flight,
origin,
destination
);





/*
=========================
DEPARTURE CARD
=========================
*/


if(split.outbound.length){


departureFlights.push({


id:index,


price:
flight.price || 0,


airline:
split.outbound[0]?.airline ||
"Airline",



airline_logo:
split.outbound[0]?.airline_logo ||
"",



duration:
flight.total_duration || 0,



flights:
split.outbound



});



}







/*
=========================
RETURN CARD
SAME ROUND TRIP PRICE
=========================
*/


if(split.inbound.length){


returnFlights.push({


id:index,


price:
flight.price || 0,



airline:
split.inbound[0]?.airline ||
"Airline",



airline_logo:
split.inbound[0]?.airline_logo ||
"",



duration:
flight.total_duration || 0,



flights:
split.inbound



});



}



});







console.log(
"DEPARTURES:",
departureFlights.length
);



console.log(
"RETURNS:",
returnFlights.length
);



console.log(
"PRICE CHECK:",
{
departure:
departureFlights[0]?.price,

return:
returnFlights[0]?.price

}
);






return res.status(200).json({

departure:
departureFlights,


return:
returnFlights

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
