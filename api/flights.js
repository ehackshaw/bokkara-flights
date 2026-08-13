export default async function handler(req,res){
res.setHeader(
"Access-Control-Allow-Origin",
"\*"
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
"google\_flights"
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
"deep\_search",
"true"
);
params.set(
"show\_hidden",
"true"
);
params.set(
"sort\_by",
"2"
);
params.set(
"api\_key",
process.env.SERPAPI\_KEY
);
const url =
"[https://serpapi.com/search.json](https://serpapi.com/search.json)?"
\+
params.toString();
console.log(
"SERP REQUEST:",
url.replace(
process.env.SERPAPI\_KEY,
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
segment.departure\_airport?.id || "",
segment.arrival\_airport?.id || "",
segment.flight\_number || ""
].join("-");
}).join("|");
}
function normalizeFlights(data){
const results = [
...(data.best\_flights || []),
...(data.other\_flights || [])
];
console.log(
"🔥 TOTAL RAW SERP FLIGHTS:",
results.length
);
return results.map((flight,index)=>{
const segments =
flight.flights || [];
return {
id\:index,
price:
flight.price || 0,
airline:
segments[0]?.airline ||
"Airline",
airline\_logo:
segments[0]?.airline\_logo ||
"",
duration:
flight.total\_duration || 0,
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
const departure\_date =
body.departure\_date;
const return\_date =
body.return\_date;
if(
!origin ||
!destination ||
!departure\_date
){
return res.status(400).json({
error:"Missing flight fields"
});
}
/\*
\*/
const departureParams =
new URLSearchParams();
departureParams.set(
"departure\_id",
origin
);
departureParams.set(
"arrival\_id",
destination
);
departureParams.set(
"outbound\_date",
departure\_date
);
if(return\_date){
departureParams.set(
"return\_date",
return\_date
);
}
departureParams.set(
"type",
return\_date ? "1" : "2"
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
departureRaw\.map((flight,index)=>{
return {
id\:index,
price:
flight.price,
airline:
flight.airline,
airline\_logo:
flight.airline\_logo,
duration:
flight.duration,
signature:
flight.signature,
flights:
flight.flights
};
});
let returnFlights=[];
/\*
\*/
if(return\_date){
const returnParams =
new URLSearchParams();
returnParams.set(
"departure\_id",
destination
);
returnParams.set(
"arrival\_id",
origin
);
returnParams.set(
"outbound\_date",
return\_date
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
returnRaw\.length
);
returnFlights =
returnRaw\.map((flight,index)=>{
/\*
SMART PRICE MATCHING
\*/
const exactMatch =
departureRaw\.find(
(dep)=>
dep.signature === flight.signature
);
const airlineMatch =
departureRaw\.find(
(dep)=>
dep.airline === flight.airline
);
return {
id\:index,
price:
exactMatch?.price ||
airlineMatch?.price ||
departureRaw[0]?.price ||
flight.price,
airline:
flight.airline,
airline\_logo:
flight.airline\_logo,
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
message\:error.message
});
}
}
