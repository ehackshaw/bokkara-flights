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

console.log(
"SERP ERROR:",
json
);

throw new Error(
"SerpAPI ERROR "+response.status
);

}

return json;

}

function createSignature(segments){

return segments.map(segment=>{

return [

segment.departure_airport?.id || "",

segment.arrival_airport?.id || "",

segment.flight_number || ""

].join("-");

}).join("|");

}

function normalizeFlights(data){

const results = [

...(data.best_flights || []),

...(data.other_flights || [])

];

console.log(
"🔥 TOTAL RAW SERP FLIGHTS:",
results.length
);

return results.map((flight,index)=>{

const segments =
flight.flights || [];

return {

id:index,

price:
flight.price || 0,

airline:

segments[0]?.airline ||

"Airline",

airline_logo:

segments[0]?.airline_logo ||

"",

duration:

flight.total_duration || 0,

signature:

createSignature(segments),

flights:

segments

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

*/

const departureParams =
new URLSearchParams();

departureParams.set(
"departure_id",
origin
);

departureParams.set(
"arrival_id",
destination
);

departureParams.set(
"outbound_date",
departure_date
);

if(return_date){

departureParams.set(
"return_date",
return_date
);

}

departureParams.set(
"type",
return_date ? "1" : "2"
);

const departureData =
await serpSearch(
departureParams
);

console.log(
"🔥 DEPARTURE KEYS:",
Object.keys(departureData)
);

const departureRaw =
normalizeFlights(
departureData
);

const departureFlights =
departureRaw.map((flight,index)=>{

return {

id:index,

price:
flight.price,

airline:
flight.airline,

airline_logo:
flight.airline_logo,

duration:
flight.duration,

signature:
flight.signature,

flights:
flight.flights

};

});

let returnFlights=[];

/*

*/

if(return_date){

const returnParams =
new URLSearchParams();

returnParams.set(
"departure_id",
destination
);

returnParams.set(
"arrival_id",
origin
);

returnParams.set(
"outbound_date",
return_date
);

returnParams.set(
"type",
"2"
);

const returnData =
await serpSearch(
returnParams
);

console.log(
"🔥 RETURN KEYS:",
Object.keys(returnData)
);

const returnRaw =
normalizeFlights(
returnData
);

console.log(
"🔥 RETURN COUNT:",
returnRaw.length
);

returnFlights =
returnRaw.map((flight,index)=>{

/*

SMART PRICE MATCHING

Exact itinerary match
Airline fallback
First available price
====================================
*/

const exactMatch =
departureRaw.find(
(dep)=>
dep.signature === flight.signature
);

const airlineMatch =
departureRaw.find(
(dep)=>
dep.airline === flight.airline
);

return {

id:index,

price:

exactMatch?.price ||

airlineMatch?.price ||

departureRaw[0]?.price ||

flight.price,

airline:

flight.airline,

airline_logo:

flight.airline_logo,

duration:

flight.duration,

signature:

flight.signature,

flights:

flight.flights

};

});

}

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
