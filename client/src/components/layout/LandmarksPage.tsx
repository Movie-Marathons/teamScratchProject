// import { useEffect, useMemo, useState } from 'react';
// import type { Feature, FeatureCollection, Point } from 'geojson';

// type LandmarkProps = {
//   RESNAME?: string;
//   Address?: string;
//   City?: string;
//   State?: string;
// };

// type LandmarkFeature = Feature<Point | any, LandmarkProps>;

// // Fetching historical landmarks from ArcGIS REST
// // DC query
// // const DC_API =
// //   'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query?where=1%3D1&geometry=-77.12%2C38.79%2C-76.90%2C39.00&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=RESNAME%2CAddress%2CCity%2CState&returnGeometry=true&f=geojson';

// // NY query
// const NY_API =
//   'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query?where=1%3D1&geometry=-74.02%2C40.70%2C-73.92%2C40.88&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=RESNAME%2CAddress%2CCity%2CState&returnGeometry=true&f=geojson';

// export default function LandmarksPage() {
//   const [features, setFeatures] = useState<LandmarkFeature[]>([]);
//   const [q, setQ] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [err, setErr] = useState<string | null>(null);

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch(NY_API);
//         if (!res.ok)
//           throw new Error(`Failed to fetch landmarks (${res.status})`);
//         const data: FeatureCollection = await res.json();
//         const feats = (data.features ?? []) as LandmarkFeature[];
//         setFeatures(feats);
//       } catch (e: unknown) {
//         setErr(e instanceof Error ? e.message : 'Unknown error');
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   const filtered = useMemo(() => {
//     const term = q.trim().toLowerCase();
//     if (!term) return features;

//     return features.filter((f) => {
//       const p = f.properties ?? {};
//       const name = (p.RESNAME ?? '').toLowerCase();
//       const addr = [p.Address ?? '', p.City ?? '', p.State ?? '']
//         .filter(Boolean)
//         .join(', ')
//         .toLowerCase();
//       return name.includes(term) || addr.includes(term);
//     });
//   }, [q, features]);

//   if (loading) return <div className="p-6">Loading landmarks…</div>;
//   if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

//   return (
//     <div className="p-6 space-y-4">
//       <div className="flex items-end justify-between">
//         <h2 className="text-2xl font-semibold">Historic Landmarks</h2>
//         <small className="text-gray-500">
//           Showing {filtered.length} of {features.length}
//         </small>
//       </div>

//       <div className="flex gap-2">
//         <input
//           className="border rounded px-3 py-2 w-full max-w-md"
//           placeholder="Search by name or address…"
//           value={q}
//           onChange={(e) => setQ(e.target.value)}
//         />
//       </div>

//       <ul className="divide-y border rounded">
//         {filtered.map((f, i) => {
//           const p = f.properties ?? {};
//           const name = p.RESNAME ?? 'Unknown';
//           const addr =
//             [p.Address, p.City, p.State].filter(Boolean).join(', ') || '—';

//           return (
//             <li key={f.id?.toString() ?? i} className="p-3">
//               <div className="font-medium">{name}</div>
//               <div className="text-sm text-gray-600">{addr}</div>
//             </li>
//           );
//         })}
//       </ul>
//     </div>
//   );
// }

import { useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection, Point } from 'geojson';

type LandmarkProps = {
  RESNAME?: string;
  Address?: string;
  City?: string;
  State?: string;
};

type LandmarkFeature = Feature<Point | any, LandmarkProps>;

// 1) Get the zip code
async function zipToGeo(zip: string) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error(`Invalid ZIP: ${zip}`);
  const data = await res.json();
  const latitude = parseFloat(data.places?.[0]?.latitude);
  const longitude = parseFloat(data.places?.[0]?.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error('ZIP has no coordinates');
  }
  return { lat: latitude, lng: longitude };
}

// 2) Make a bbox around a point (meters)
function pointToEnvelope(lat: number, lng: number, radiusMeters = 3000) {
  const mPerDegLat = 111_320; // ~ meters per degree latitude
  const mPerDegLng = Math.cos((lat * Math.PI) / 180) * 111_320; // varies with latitude

  const dLat = radiusMeters / mPerDegLat;
  const dLng = radiusMeters / mPerDegLng;

  return {
    west: lng - dLng,
    south: lat - dLat,
    east: lng + dLng,
    north: lat + dLat,
  };
}

/* ---------- Build NPS query URL from bounds ---------- */
function buildNpsUrlFromBounds(b: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  const base =
    'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';

  const qs = new URLSearchParams({
    where: '1=1',
    geometry: `${b.west},${b.south},${b.east},${b.north}`, // xmin,ymin,xmax,ymax
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'RESNAME,Address,City,State',
    returnGeometry: 'true',
    f: 'geojson',
  });

  return `${base}?${qs.toString()}`;
}

export default function LandmarksPage() {
  const [features, setFeatures] = useState<LandmarkFeature[]>([]);
  const [q, setQ] = useState('');
  const [zip, setZip] = useState('10001'); // user-entered ZIP
  //   const [radius, setRadius] = useState(3000); // meters
  //   const [radiusMiles, setRadiusMiles] = useState(2); // miles
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Fetch landmarks near the ZIP using Zippopotam (ZIP -> lat/lng) + bbox
  const loadByZip = async () => {
    try {
      setErr(null);
      setLoading(true);

      if (!/^\d{5}(-\d{4})?$/.test(zip)) {
        throw new Error('Enter a valid US ZIP (e.g., 10001)');
      }

      // 1) ZIP -> lat/lng (no token)
      const { lat, lng } = await zipToGeo(zip);

      // 2) lat/lng -> bbox using chosen radius
      const bounds = pointToEnvelope(lat, lng);

      // 3) bbox -> NPS query
      const url = buildNpsUrlFromBounds(bounds);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch landmarks (${res.status})`);

      const data: FeatureCollection = await res.json();
      setFeatures((data.features ?? []) as LandmarkFeature[]);
    } catch (e: any) {
      setErr(e?.message || 'Unknown error');
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load once on mount using the default ZIP
  useEffect(() => {
    loadByZip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return features;

    return features.filter((f) => {
      const p = f.properties ?? {};
      const name = (p.RESNAME ?? '').toLowerCase();
      const addr = [p.Address ?? '', p.City ?? '', p.State ?? '']
        .filter(Boolean)
        .join(', ')
        .toLowerCase();
      return name.includes(term) || addr.includes(term);
    });
  }, [q, features]);

  if (loading) return <div className="p-6">Loading landmarks…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold">Historic Landmarks</h2>
        <small className="text-gray-500">
          Showing {filtered.length} of {features.length}
        </small>
      </div>

      {/* ZIP + radius controls + search + your existing name/address filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="border rounded px-3 py-2 w-32"
          placeholder="ZIP (e.g. 10001)"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
        />
        {/* <input
          className="border rounded px-3 py-2 w-28"
          type="number"
          min={0.5}
          step={0.5}
          value={radius}
          onChange={(e) => setRadiusMiles(Number(e.target.value))}
          title="Search radius in miles"
        /> */}
        <button
          className="px-3 py-2 rounded bg-black text-white"
          onClick={loadByZip}
        >
          Search by ZIP
        </button>

        <input
          className="border rounded px-3 py-2 w-full max-w-md ml-auto"
          placeholder="Filter by name or address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="divide-y border rounded">
        {filtered.map((f, i) => {
          const p = f.properties ?? {};
          const name = p.RESNAME ?? 'Unknown';
          const addr =
            [p.Address, p.City, p.State].filter(Boolean).join(', ') || '—';

          return (
            <li key={f.id?.toString() ?? i} className="p-3">
              <div className="font-medium">{name}</div>
              <div className="text-sm text-gray-600">{addr}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// TEST CASE!!!!
// Import React hooks you'll use in this component                                     //
// import { useMemo, useState } from 'react';

// // Import GeoJSON types so your data is strongly typed                                   //
// import type { Feature, FeatureCollection, Point } from 'geojson';

// // ----------------------------- Types for landmark features --------------------------- //

// // Shape of the attributes (properties) returned by the NPS layer                        //
// type LandmarkProps = {
//   RESNAME?: string; // Landmark (resource) name                                          //
//   Address?: string; // Street address                                                    //
//   City?: string; // City                                                              //
//   State?: string; // State                                                             //
// };

// // A single GeoJSON Feature for a landmark, with a (Point or any) geometry and props     //
// type LandmarkFeature = Feature<Point | any, LandmarkProps>;

// // ----------------------------- Geocoding: ZIP -> bounds ------------------------------ //

// /**
//  * Looks up a US ZIP code using ArcGIS World Geocoding and returns a bounding box.
//  * We call `findAddressCandidates` with:
//  *  - SingleLine: the ZIP itself
//  *  - category=Postal to focus the search
//  *  - countryCode=USA to avoid non-US matches
//  *  - outSR=4326 so extents are in WGS84 (lon/lat) which NPS expects
//  * If the service requires auth for your usage, pass a token.
//  */
// async function zipToBoundsArcgis(zip: string, token?: string) {
//   // Base endpoint for ArcGIS World Geocoding service                                     //
//   const base =
//     'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

//   // Build the parameters for the request                                                  //
//   const form = new URLSearchParams({
//     SingleLine: zip, // Search string is just the ZIP                              //
//     category: 'Postal', // Hint the locator we're searching postal codes              //
//     countryCode: 'USA', // Restrict to US results                                     //
//     outFields: '*', // Ask for all fields (we mainly need `extent`)               //
//     maxLocations: '1', // Only the top candidate                                     //
//     outSR: '4326', // Output spatial ref WGS84 (lon/lat)                         //
//     f: 'json', // JSON response                                              //
//   });

//   // If you have a token (e.g., forStorage=true workflows or higher quota), include it    //
//   if (token) form.set('token', token);

//   // POST the x-www-form-urlencoded body to the endpoint (no query string here)           //
//   const res = await fetch(base, {
//     method: 'POST', // Use POST to avoid long URLs   //
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, // Form content type //
//     body: form, // Send the encoded parameters   //
//   });

//   // If HTTP status is not in the 200-299 range, throw                                     //
//   if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

//   // Parse the JSON response                                                               //
//   const data = await res.json();

//   // Grab the first candidate (we limited maxLocations=1)                                   //
//   const candidate = data?.candidates?.[0];

//   // If nothing found, surface a clear error                                               //
//   if (!candidate) throw new Error('ZIP not found');

//   // Extract the bounding box from the candidate                                            //
//   const ext = candidate.extent; // { xmin, ymin, xmax, ymax }                              //

//   // Guard: rare cases may not include an extent                                            //
//   if (!ext) throw new Error('No extent returned for ZIP');

//   // Return a normalized object with west/south/east/north for convenience                 //
//   return {
//     west: ext.xmin, // xmin is the western longitude                                      //
//     south: ext.ymin, // ymin is the southern latitude                                       //
//     east: ext.xmax, // xmax is the eastern longitude                                       //
//     north: ext.ymax, // ymax is the northern latitude                                       //
//   };
// }

// // ----------------------------- Build NPS query URL ----------------------------------- //

// /**
//  * Given an envelope (bounds) in WGS84, build the NPS NRHP query URL.
//  * The NPS map service accepts an `esriGeometryEnvelope` via `geometry=xmin,ymin,xmax,ymax`.
//  */
// function buildNpsUrlFromBounds(b: {
//   west: number; // xmin                                                                     //
//   south: number; // ymin                                                                     //
//   east: number; // xmax                                                                     //
//   north: number; // ymax                                                                     //
// }) {
//   // Base URL for the NPS National Register of Historic Places layer                        //
//   const base =
//     'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';

//   // Assemble the query string parameters                                                   //
//   const qs = new URLSearchParams({
//     where: '1=1', // No attribute filter; return all matches //
//     geometry: `${b.west},${b.south},${b.east},${b.north}`, // Envelope xmin,ymin,xmax,ymax   //
//     geometryType: 'esriGeometryEnvelope', // Tell the service what `geometry` is     //
//     inSR: '4326', // Input SR is WGS84                       //
//     spatialRel: 'esriSpatialRelIntersects', // Return features intersecting the bbox   //
//     outFields: 'RESNAME,Address,City,State', // Only the fields you need                //
//     returnGeometry: 'true', // Include geometry in the GeoJSON          //
//     f: 'geojson', // Ask for GeoJSON                         //
//   });

//   // Return the full URL (base + query string)                                              //
//   return `${base}?${qs.toString()}`;
// }

// // ----------------------------- React component --------------------------------------- //

// export default function LandmarksPage() {
//   // State: the landmarks returned from the NPS service                                     //
//   const [features, setFeatures] = useState<LandmarkFeature[]>([]);

//   // State: client-side text filter (name/address)                                          //
//   const [q, setQ] = useState(''); // Controlled input for filtering                         //

//   // State: the ZIP to look up (pre-filled with a common example)                           //
//   const [zip, setZip] = useState('10001');

//   // State: optional ArcGIS token if your usage requires authenticated geocoding            //
//   const [token, setToken] = useState('');

//   // State: spinner flag while requests are in-flight                                       //
//   const [loading, setLoading] = useState(false);

//   // State: error message to show the user                                                  //
//   const [err, setErr] = useState<string | null>(null);

//   // Handler that geocodes the ZIP, builds the NPS URL, fetches features, and stores them   //
//   async function loadByZip() {
//     try {
//       setErr(null); // Clear previous errors                                       //
//       setLoading(true); // Show loading indicator                                      //

//       // Basic validation for US ZIP or ZIP+4                                               //
//       if (!/^\d{5}(-\d{4})?$/.test(zip)) {
//         throw new Error('Enter a valid US ZIP (e.g., 10001)');
//       }

//       // 1) Geocode the ZIP to get its bounds                                               //
//       const bounds = await zipToBoundsArcgis(zip, token || undefined);

//       // 2) Build the NPS query URL using that envelope                                     //
//       const url = buildNpsUrlFromBounds(bounds);

//       // 3) Fetch features from the NPS layer                                               //
//       const res = await fetch(url);

//       // If the request failed, bail out with a clear message                               //
//       if (!res.ok) throw new Error(`Failed to fetch landmarks (${res.status})`);

//       // Parse the GeoJSON feature collection                                               //
//       const data: FeatureCollection = await res.json();

//       // Normalize/guard the features array                                                 //
//       const feats = (data.features ?? []) as LandmarkFeature[];

//       // Store the features in state (triggers re-render)                                   //
//       setFeatures(feats);
//     } catch (e: unknown) {
//       // If we caught an error, capture its message (or a fallback)                         //
//       setErr(e instanceof Error ? e.message : 'Unknown error');

//       // Clear any stale results on error                                                   //
//       setFeatures([]);
//     } finally {
//       // Always stop the spinner                                                            //
//       setLoading(false);
//     }
//   }

//   // Derive a filtered list of features based on the search box `q`                         //
//   const filtered = useMemo(() => {
//     const term = q.trim().toLowerCase(); // Normalize the query                             //
//     if (!term) return features; // If empty, show everything                      //

//     // Keep features whose name or address contains the term                                //
//     return features.filter((f) => {
//       const p = f.properties ?? {}; // Safe access to props      //
//       const name = (p.RESNAME ?? '').toLowerCase(); // Landmark name             //
//       const addr = [p.Address ?? '', p.City ?? '', p.State ?? ''] // Address parts          //
//         .filter(Boolean) // Drop empties              //
//         .join(', ') // Join for display          //
//         .toLowerCase(); // Normalize                 //
//       return name.includes(term) || addr.includes(term); // Match either field        //
//     });
//   }, [q, features]); // Recompute when search term or features change                        //

//   // ----------------------------- JSX UI ------------------------------------------------ //
//   return (
//     // Outer container with padding and vertical spacing                                   //
//     <div className="p-6 space-y-4">
//       {/* Header row: title and a small count display                                       */}
//       <div className="flex items-end justify-between">
//         <h2 className="text-2xl font-semibold">Historic Landmarks</h2>
//         <small className="text-gray-500">
//           {/* Show how many survive filtering vs total                                       */}
//           Showing {filtered.length} of {features.length}
//         </small>
//       </div>

//       {/* Controls row: ZIP input, optional token, search button, and text filter           */}
//       <div className="flex flex-wrap gap-2 items-center">
//         {/* ZIP input (controlled by `zip`)                                                 */}
//         <input
//           className="border rounded px-3 py-2 w-32"
//           placeholder="ZIP (e.g. 10001)"
//           value={zip}
//           onChange={(e) => setZip(e.target.value)} // Update ZIP as user types             //
//         />
//         {/* Optional ArcGIS token input
//         <input
//           className="border rounded px-3 py-2 flex-1 min-w-[12rem]"
//           placeholder="(Optional) ArcGIS token"
//           value={token}
//           onChange={(e) => setToken(e.target.value)} // Update token in state              //
//         /> */}
//         {/* Button to kick off the geocode + NPS fetch flow                                 */}
//         <button
//           className="px-3 py-2 rounded bg-black text-white"
//           onClick={loadByZip} // Run the handler when clicked                //
//           disabled={loading} // Prevent double-clicks while loading         //
//         >
//           {loading ? 'Loading…' : 'Search by ZIP'}
//         </button>

//         {/* Client-side text filter for the displayed list                                   */}
//         <input
//           className="border rounded px-3 py-2 w-full max-w-md ml-auto"
//           placeholder="Filter by name or address…"
//           value={q}
//           onChange={(e) => setQ(e.target.value)} // Update filter term                     //
//         />
//       </div>

//       {/* Error banner (if any)                                                             */}
//       {err && <div className="text-red-600">{err}</div>}

//       {/* Lightweight loading text (button label also changes)                               */}
//       {loading && <div>Loading landmarks…</div>}

//       {/* Results list                                                                       */}
//       <ul className="divide-y border rounded">
//         {filtered.map((f, i) => {
//           // Guard props access                                                              //
//           const p = f.properties ?? {};
//           // Display name or fallback                                                       //
//           const name = p.RESNAME ?? 'Unknown';
//           // Compose a readable address or a dash                                           //
//           const addr =
//             [p.Address, p.City, p.State].filter(Boolean).join(', ') || '—';

//           return (
//             // Use stable feature id when present, otherwise fallback to index               //
//             <li key={f.id?.toString() ?? i} className="p-3">
//               {/* Landmark name                                                              */}
//               <div className="font-medium">{name}</div>
//               {/* Landmark address                                                            */}
//               <div className="text-sm text-gray-600">{addr}</div>
//             </li>
//           );
//         })}
//       </ul>
//     </div>
//   );
// }
