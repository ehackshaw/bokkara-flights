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
String(body.origin || "")
.trim()
.toUpperCase();


const destination=
String(body.destination || "")
.trim()
.toUpperCase();


const departure_date=
body.departure_date;


const return_date=
body.return_date;


const adults=
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
"api_key",
process.env.SERPAPI_KEY
);



const url=
"https://serpapi.com/search.json?"
+
params.toString();



console.log(
"SERP:",
url
);



const response=
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


const segment=
flight.flights?.[0] || {};



return {


price:
flight.price || 0,


departure_token:
flight.departure_token || "",



airline:
segment.airline || "Airline",


airline_logo:
flight.airline_logo || "",



total_duration:
flight.total_duration || 0,



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



flights:
flight.flights || [],


segments:
flight.flights || []


};


});


}






/*
========================
SEARCH DEPARTURE
========================
*/


const outboundParams=
new URLSearchParams();


outboundParams.set(
"departure_id",
origin
);


outboundParams.set(
"arrival_id",
destination
);


outboundParams.set(
"outbound_date",
departure_date
);



if(return_date){

outboundParams.set(
"return_date",
return_date
);


outboundParams.set(
"type",
"1"
);

}
else{

outboundParams.set(
"type",
"2"
);

}




const outboundData=
await serpSearch(outboundParams);



console.log(
"OUTBOUND KEYS:",
Object.keys(outboundData)
);



const departureFlights=
normalizeFlights(outboundData);



console.log(
"DEPARTURE COUNT:",
departureFlights.length
);






/*
========================
SEARCH RETURN USING TOKEN
========================
*/


let returnFlights=[];



if(return_date && departureFlights.length){



const token=
departureFlights[0].departure_token;



console.log(
"USING TOKEN:",
token
);



if(token){


const returnParams=
new URLSearchParams();


returnParams.set(
"departure_token",
token
);



const returnData=
await serpSearch(returnParams);



console.log(
"RETURN KEYS:",
Object.keys(returnData)
);



returnFlights=
normalizeFlights(returnData);



}



}





console.log(
"RETURN COUNT:",
returnFlights.length
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
"🔥 ERROR:",
error
);



return res.status(500).json({

error:"Server crashed",

message:error.message

});


}


}
