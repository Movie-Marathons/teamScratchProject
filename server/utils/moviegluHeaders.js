// moviegluHeaders.js
// export function buildMovieGluHeaders(overrides = {}) {
//   const deviceDatetime = new Date().toISOString().replace("Z", ""); // ISO8601 w/o offset
//   return {
//     client: process.env.MG_CLIENT,
//     "x-api-key": process.env.MG_API_KEY,
//     authorization: process.env.MG_AUTH,
//     territory: process.env.MG_TERRITORY,              // e.g., "XX"
//     "api-version": process.env.MG_API_VERSION,        // e.g., "v201"
//     geolocation: process.env.MG_GEO,                  // e.g., "-22.0;14.0"
//     "device-datetime": deviceDatetime,
//     accept: "application/json",
//     ...overrides, // allow per-call overrides if needed
//   };
// }


//Good Headers
const baseHeaders = {
  client: 'APPS_0',
  'x-api-key': 'hRo2RN8OQa2HIkdNW5XnQ7s4qsfYcFn3ooJ6opdc', 
  Authorization: 'Basic QVBQU18wOkZ1VE5zZktBY0t3UQ',      
  territory: 'US',                                           
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  Host: 'api-gate2.movieglu.com',
};