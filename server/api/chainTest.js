import { zipToGeo } from "./zipConverterAPI.js";
import { getCinemas } from "./cinemaAPI.js";


const latlong = zipToGeo(79922);
console.log(latlong);

// console.log(getCinemas(latlong));