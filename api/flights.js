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



const response =
await fetch(url);



const json =
await response.json();



console.log(
"SERP STATUS:",
response.status
);



if(!response.ok){

throw new Error(
"SerpAPI ERROR "+response.status
);

}



return json;


}





function normalizeFlight(flight, index){


const segments =
flight.flights || [];



const departure =
segments[0] || {};



const arrival =
segments[segments.length - 1] || {};



return {


id:index,


price:
flight.price || 0,



airline:

departure.airline ||
"Airline",



airline_logo:

departure.airline_logo ||
"",



departure_airport:{


id:
departure.departure_airport?.id || "",


time:
departure.departure_airport?.time || ""

},



arrival_airport:{


id:
arrival.arrival_airport?.id || "",


time:
arrival.arrival_airport?.time || ""

},



duration:

flight.total_duration || 0,



flights:

segments


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





const data =
await serpSearch(params);



console.log(
"GOOGLE FLIGHTS KEYS:",
Object.keys(data)
);




const results = [

...(data.best_flights || []),

...(data.other_flights || [])

];



const departureFlights = [];

const returnFlights = [];



results.forEach((flight,index)=>{


const segments =
flight.flights || [];



if(segments.length){



// outbound leg

departureFlights.push(

normalizeFlight(
{
...flight,
flights:[segments[0]]
},
index
)

);



// inbound leg exists

if(return_date && segments.length > 1){


returnFlights.push(

normalizeFlight(
{
...flight,
flights:[
segments[segments.length - 1]
],
price:flight.price
},
index
)

);


}



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
