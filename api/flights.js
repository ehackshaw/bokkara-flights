export default async function handler(req,res){

res.setHeader("Access-Control-Allow-Origin","*");
res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers","Content-Type");


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

console.log("🔥 REQUEST:",body);



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
"SERP URL:",
url.replace(process.env.SERPAPI_KEY,"HIDDEN")
);



const response =
await fetch(url);



if(!response.ok){

throw new Error(
"SerpAPI "+response.status
);

}


return await response.json();


}





function normalizeFlights(data){


const raw=[

...(data.best_flights || []),

...(data.other_flights || [])

];



return raw.map(flight=>{


const segment =
flight.flights?.[0] || {};



return{


price:
flight.price || 0,


departure_token:
flight.departure_token || "",


airline:
segment.airline || "Airline",


airline_logo:
flight.airline_logo || "",



departure_airport:{

id:
segment.departure_airport?.id || "",

time:
segment.departure_airport?.time || ""

},



arrival_airport:{

id:
segment.arrival_airport?.id || "",

time:
segment.arrival_airport?.time || ""

},


duration:
flight.total_duration || 0,


flights:
flight.flights || []

};


});


}





/*
========================
RETURN SEARCH
========================
*/


if(body.departure_token){



console.log(
"🔁 RETURN SEARCH TOKEN:",
body.departure_token
);



const params =
new URLSearchParams();



params.set(
"departure_token",
body.departure_token
);



params.set(
"return_date",
body.return_date
);



const returnData =
await serpSearch(params);



console.log(
"RETURN KEYS:",
Object.keys(returnData)
);



return res.status(200).json({

return:
normalizeFlights(returnData)

});


}







/*
========================
INITIAL DEPARTURE SEARCH
========================
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
"INITIAL KEYS:",
Object.keys(data)
);



const flights =
normalizeFlights(data);



console.log(
"DEPARTURE COUNT:",
flights.length
);



return res.status(200).json({

departure:flights,

return:[]

});


}



catch(error){

console.error(
"🔥 ERROR:",
error
);


return res.status(500).json({

error:"Server crashed",

message:error.message

});


}


}
