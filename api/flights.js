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





function normalizeLeg(flight, price, leg){


const segments =
flight.flights || [];



const first =
segments[0] || {};



const last =
segments[segments.length - 1] || {};



return {


id:
Date.now()+Math.random(),


price:price,


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


flights:segments,


leg:leg


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
ROUND TRIP SEARCH
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


params.set(
"type",
"1"
);


}else{


params.set(
"type",
"2"
);


}





const searchData =
await serpSearch(params);





console.log(
"RAW ROUND TRIP RESPONSE",
JSON.stringify(searchData,null,2)
);





const itineraries = [

...(searchData.best_flights || []),

...(searchData.other_flights || [])

];



let departureFlights = [];

let returnFlights = [];






itineraries.forEach((flight)=>{


const totalPrice =
flight.price || 0;




let outboundSegments =
flight.flights ||
flight.outbound_flights ||
[];




let returnSegments =
flight.return_flights ||
flight.inbound_flights ||
[];





/*
====================================
HANDLE COMBINED FLIGHT ARRAYS
====================================
*/


if(
!returnSegments.length &&
outboundSegments.length
){


let splitPoint =
outboundSegments.findIndex(
(segment)=>
segment.departure_airport?.id === destination
);



if(splitPoint > -1){


returnSegments =
outboundSegments.slice(splitPoint);



outboundSegments =
outboundSegments.slice(0,splitPoint);



}


}






/*
====================================
CREATE DEPARTURE CARD
====================================
*/


if(outboundSegments.length){


departureFlights.push(

normalizeLeg(

{
flights:outboundSegments,
total_duration:flight.total_duration

},

totalPrice,

"departure"

)

);


}






/*
====================================
CREATE RETURN CARD
====================================
*/


if(returnSegments.length){


returnFlights.push(

normalizeLeg(

{
flights:returnSegments,
total_duration:flight.total_duration

},

totalPrice,

"return"

)

);


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
