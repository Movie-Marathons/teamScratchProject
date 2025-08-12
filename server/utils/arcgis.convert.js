function esriJsonToGeoJSON(esri) {
  const features = (esri?.features ?? []).map((f, i) => {
    const a = f.attributes || {};
    const g = f.geometry || {};
    const coords =
      g.x != null && g.y != null
        ? [Number(g.x), Number(g.y)]
        : Array.isArray(g?.rings)
        ? g.rings
        : null; // not needed here, but safe

    return {
      type: 'Feature',
      id: a.OBJECTID ?? i,
      geometry: { type: 'Point', coordinates: coords },
      properties: a,
    };
  });
  return { type: 'FeatureCollection', features };
}

module.exports = { esriJsonToGeoJSON };
