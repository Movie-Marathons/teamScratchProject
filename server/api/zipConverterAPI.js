
export async function zipToGeo(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) throw new Error(`Invalid ZIP: ${zip}`);

    const data = await res.json();
    const { latitude, longitude } = data.places[0];

    return `${latitude};${longitude}`;
  } catch (err) {
    console.error(`Error fetching location for ZIP ${zip}:`, err.message);
    return null;
  }
}


// console.log(zipToGeo(79922));