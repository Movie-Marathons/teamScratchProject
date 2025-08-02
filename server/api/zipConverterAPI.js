
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

(async() => { 
  try {const result = await zipToGeo('79922');
    console.log(result)
  } catch (error) {console.log('Error:', error.message)
    }
  }) ();

//console.log(zipToGeo(79922));