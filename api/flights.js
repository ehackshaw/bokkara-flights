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






function normalizeFlights(data){



const results = [

...(data.best_flights || []),

...(data.other_flights || [])

];



return results.map((flight,index)=>{


const segments =
flight.flights || [];



return {


id:index,


// IMPORTANT:
// This is the Google Flights total itinerary price

price:
flight.price || 0,



flights:
segments,


airline:
segments[0]?.airline ||
"Airline",



airline_logo:
segments[0]?.airline_logo ||
"",



duration:
flight.total_duration ||
0


};


});


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



/*
1 = Round Trip
2 = One Way
*/

params.set(
"type",
return_date ? "1" : "2"
);





const flightData =
await serpSearch(params);





console.log(
"RAW SERP KEYS:",
Object.keys(flightData)
);





const allFlights =
normalizeFlights(
flightData
);





let departureFlights = [];

let returnFlights = [];







allFlights.forEach((flight,index)=>{


const segments =
flight.flights || [];



if(!segments.length){

return;

}





/*
Find where outbound ends
and return begins

Example:

POS -> PTY
PTY -> POS

The return starts when
departure airport equals destination
*/


let returnStartIndex =
segments.findIndex(segment =>

segment.departure_airport?.id === destination

);





/*
If no return leg exists,
skip it
*/

if(
return_date &&
returnStartIndex === -1
){

return;

}





let outboundSegments =
segments.slice(
0,
returnStartIndex === -1
?
segments.length
:
returnStartIndex
);





let inboundSegments =
segments.slice(
returnStartIndex
);








/*
==============================
DEPARTURE CARD
==============================
*/


if(outboundSegments.length){


departureFlights.push({

id:index,


price:
flight.price,


airline:
flight.airline,


airline_logo:
flight.airline_logo,


duration:
flight.duration,


flights:
outboundSegments,


departure_airport:
outboundSegments[0].departure_airport,


arrival_airport:
outboundSegments[outboundSegments.length-1].arrival_airport


});


}








/*
==============================
RETURN CARD
==============================
*/


if(
return_date &&
inboundSegments.length
){


returnFlights.push({

id:index,


// KEEP SAME GOOGLE FLIGHTS TOTAL PRICE

price:
flight.price,


airline:
flight.airline,


airline_logo:
flight.airline_logo,


duration:
flight.duration,


flights:
inboundSegments,


departure_airport:
inboundSegments[0].departure_airport,


arrival_airport:
inboundSegments[inboundSegments.length-1].arrival_airport


});


}



});







console.log(
"TOTAL ITINERARIES:",
allFlights.length
);



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
departureFlights[0]?.price,
returnFlights[0]?.price
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
