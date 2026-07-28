ok lets try it your way. tell me what to do here 

export default async function handler(req, res) {


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



if(req.method === "OPTIONS"){

return res.status(200).end();

}



if(req.method !== "POST"){

return res.status(405).json({

error:"POST only"

});

}



try{


const body = req.body || {};



console.log(
"🔥 Incoming request:",
body
);




function normalizeTrip(type){

if(!type)
return "oneway";


return String(type)
.toLowerCase()
.includes("round")
?
"roundtrip"
:
"oneway";

}




function normalizeInt(value,fallback=1){

const n =
parseInt(
String(value)
.replace(/\D/g,"")
);


return isNaN(n) || n<=0
?
fallback
:
n;

}





function addDays(date,days){

const d =
new Date(date);


d.setDate(
d.getDate()+days
);


return d
.toISOString()
.split("T")[0];

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




const tripType =
normalizeTrip(body.type);




const adults =
normalizeInt(
body.adults,
1
);





if(
!origin ||
!destination ||
!departure_date
){


return res.status(400).json({

error:"Missing required fields",

received:body

});


}





/*
 GOOGLE FLIGHTS SEARCH
*/


async function searchFlights({

from,

to,

date,

returnDate

}){


const params =
new URLSearchParams();



params.set(
"engine",
"google_flights"
);



params.set(
"departure_id",
from
);



params.set(
"arrival_id",
to
);



params.set(
"outbound_date",
date
);




// ROUND TRIP

if(returnDate){


params.set(
"return_date",
returnDate
);


params.set(
"type",
"1"
);


}


// ONE WAY

else{


params.set(
"type",
"2"
);


}




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
"adults",
adults
);



params.set(
"api_key",
process.env.SERPAPI_KEY
);





const url =

`https://serpapi.com/search.json?${params.toString()}`;





console.log(
"Searching:",
from,
"→",
to,
date,
returnDate || ""
);





const response =
await fetch(url);




if(!response.ok){

throw new Error(
"SerpAPI error " +
response.status
);

}




return await response.json();



}






function extractFlights(data){


return [

...(data.best_flights || []),

...(data.other_flights || []),

...(data.flights || [])

];


}







/*
 FLEXIBLE DATE SEARCH
*/


if(body.flexible_dates === true){



const dates=[];



for(
let i=0;
i<(body.days || 7);
i++
){


dates.push(

addDays(
departure_date,
i
)

);


}




const searches =

await Promise.all(

dates.map(date=>


searchFlights({

from:origin,

to:destination,

date,

returnDate:
tripType==="roundtrip"
?
return_date
:
null


})


)


);






const calendar =

searches.map(
(result,index)=>{


const flights =
extractFlights(result);



flights.sort(

(a,b)=>

Number(a.price || 0)

-

Number(b.price || 0)

);



return {


date:

dates[index],


price:

flights[0]?.price || null,


flights

};



}

);






return res.status(200).json({


departure:

extractFlights(searches[0]),


return:

extractFlights(searches[0]),


calendar



});



}








/*
 NORMAL SEARCH
*/



const flightData =

await searchFlights({


from:origin,


to:destination,


date:departure_date,


returnDate:

tripType==="roundtrip"

?

return_date

:

null


});





const flights =

extractFlights(
flightData
);





console.log(
"Round Trip Flights:",
flights.length
);






return res.status(200).json({



departure:

flights,



return:

flights



});






}
catch(error){



console.error(
"🔥 SERVER ERROR:",
error
);



return res.status(500).json({


error:"Server crashed",


message:error.message


});



}


}
