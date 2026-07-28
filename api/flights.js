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



const origin=
String(body.origin)
.trim()
.toUpperCase();


const destination=
String(body.destination)
.trim()
.toUpperCase();


const departure_date=
body.departure_date;


const return_date=
body.return_date;


const adults=
Number(body.adults || 1);



if(!origin || !destination || !departure_date){

return res.status(400).json({
error:"Missing fields"
});

}




async function searchFlights(){


const params=new URLSearchParams();


params.set("engine","google_flights");

params.set("departure_id",origin);

params.set("arrival_id",destination);

params.set("outbound_date",departure_date);


if(return_date){

params.set("return_date",return_date);

params.set("type","1");

}
else{

params.set("type","2");

}


params.set("currency","USD");

params.set("hl","en");

params.set("gl","us");

params.set("adults",adults);

params.set("deep_search","true");

params.set(
"api_key",
process.env.SERPAPI_KEY
);



const url=
"https://serpapi.com/search.json?"
+params.toString();



const response=await fetch(url);



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


const firstSegment =
flight.flights?.[0] || {};



return{


price:
flight.price || 0,


airline:
firstSegment.airline || flight.airline || "Airline",


airline_logo:
flight.airline_logo || "",


total_duration:
flight.total_duration || 0,


flights:
flight.flights || [],



departure_airport:{


id:
firstSegment.departure_airport?.id || origin,


time:
firstSegment.departure_airport?.time || ""


},



arrival_airport:{


id:
firstSegment.arrival_airport?.id || destination,


time:
firstSegment.arrival_airport?.time || ""


},



segments:
flight.flights || []



};


});

}





const flightData =
await searchFlights();



console.log(
"RAW KEYS:",
Object.keys(flightData)
);



const flights =
normalizeFlights(flightData);



console.log(
"NORMALIZED:",
JSON.stringify(flights[0],null,2)
);



return res.status(200).json({

departure:flights,

return:flights

});



}

catch(error){

console.error(error);


return res.status(500).json({

error:"Server crashed",

message:error.message

});


}


}
