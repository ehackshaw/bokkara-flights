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



const first =
segments[0] || {};



const last =
segments[segments.length - 1] || {};



return {


id:index,



price:

Number(flight.price || 0),



airline:

first.airline ||

"Airline",



airline_logo:

first.airline_logo ||

"",



departure_airport:{


id:

first.departure_airport?.id || "",


time:

first.departure_airport?.time || ""

},



arrival_airport:{


id:

last.arrival_airport?.id || "",


time:

last.arrival_airport?.time || ""

},



duration:

flight.total_duration || 0,



flights:

segments,



/*
RETURN LEG FROM SERPAPI
*/

return_flights:

flight.return_flights || []


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
ROUND TRIP SEARCH
ORIGIN → DESTINATION → ORIGIN
====================================
*/


const flightParams =
new URLSearchParams();



flightParams.set(
"departure_id",
origin
);



flightParams.set(
"arrival_id",
destination
);



flightParams.set(
"outbound_date",
departure_date
);



if(return_date){

flightParams.set(
"return_date",
return_date
);

}



/*
TYPE 1 = ROUND TRIP
*/

flightParams.set(
"type",
"1"
);




const flightData =
await serpSearch(
flightParams
);





const roundTripFlights =
normalizeFlights(
flightData
);





console.log(
"ROUND TRIP RESULTS:",
roundTripFlights.length
);






/*
====================================
DEPARTURE CARDS
ORIGIN → DESTINATION
SHOW TOTAL ROUND TRIP PRICE
====================================
*/


const departureFlights = roundTripFlights.map((flight,index)=>{


return {


...flight,


id:index,


direction:"departure",


price:flight.price


};


});







/*
====================================
RETURN CARDS
DESTINATION → ORIGIN
SHOW TOTAL ROUND TRIP PRICE
====================================
*/


const returnFlights = roundTripFlights.map((flight,index)=>{


const returnSegment =
flight.return_flights || [];



const firstReturn =
returnSegment[0] || {};



const lastReturn =
returnSegment[returnSegment.length - 1] || {};



return {


...flight,


id:index,


direction:"return",



departure_airport:{


id:

firstReturn.departure_airport?.id || destination,


time:

firstReturn.departure_airport?.time || ""


},



arrival_airport:{


id:

lastReturn.arrival_airport?.id || origin,


time:

lastReturn.arrival_airport?.time || ""


},



price:

flight.price,



flights:

returnSegment


};


});






console.log(
"DEPARTURE CARDS:",
departureFlights.length
);


console.log(
"RETURN CARDS:",
returnFlights.length
);





return res.status(200).json({

departure:departureFlights,

return:returnFlights

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
