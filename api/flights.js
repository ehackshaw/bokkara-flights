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



departure_token:
flight.departure_token || "",



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
====================================
FIRST GOOGLE FLIGHTS SEARCH
OUTBOUND
====================================
*/


const outboundParams =
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

}



outboundParams.set(
"type",
return_date ? "1" : "2"
);






const outboundData =
await serpSearch(outboundParams);




console.log(
"🔥 OUTBOUND RESPONSE:",
Object.keys(outboundData)
);





const outboundFlights =
normalizeFlights(
outboundData
);





let departureFlights = [];

let returnFlights = [];








/*
====================================
GET RETURN USING DEPARTURE TOKEN
====================================
*/


for(
let i=0;
i<outboundFlights.length;
i++
){


const flight =
outboundFlights[i];




departureFlights.push({

...flight,

flights:
flight.flights,


price:
flight.price


});






if(
return_date &&
flight.departure_token
){



const returnParams =
new URLSearchParams();



returnParams.set(
"departure_token",
flight.departure_token
);



const returnData =
await serpSearch(returnParams);




console.log(
"🔥 RETURN TOKEN RESPONSE:",
Object.keys(returnData)
);




const returnResults =
normalizeFlights(returnData);





returnResults.forEach((ret)=>{



returnFlights.push({


id:i,


price:
flight.price,


airline:
ret.airline ||
flight.airline,



airline_logo:
ret.airline_logo ||
flight.airline_logo,



duration:
ret.duration,



flights:
ret.flights



});



});



}



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
