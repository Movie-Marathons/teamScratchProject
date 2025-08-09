// server/controllers/landMarksController.js

const { getByBBox, getByZip } = require('../services/landmarks.service');

async function listLandmarks(req, res, next) {
  try {
    const { west, south, east, north, limit: limitRaw } = req.query;
    const nums = [west, south, east, north].map(Number);

    // Validation: all provided, numeric, finite
    if (nums.length !== 4 || nums.some((n) => Number.isNaN(n) || !Number.isFinite(n))) {
      return res.status(400).json({ error: 'Bounding box parameters must be numeric and provided.' });
    }

    // Validate ordering
    if (nums[0] >= nums[2] || nums[1] >= nums[3]) {
      return res.status(400).json({ error: 'Bounding box coordinates must satisfy west < east and south < north.' });
    }

    // Optional: enforce max bbox size to avoid massive queries
    const maxSpan = Number(process.env.MAX_BBOX_DEGREES) || 5;
    if ((nums[2] - nums[0]) > maxSpan || (nums[3] - nums[1]) > maxSpan) {
      return res.status(400).json({ error: `Bounding box span must be <= ${maxSpan} degrees.` });
    }

    let limit = undefined;
    if (limitRaw !== undefined) {
      const l = Number(limitRaw);
      if (!Number.isNaN(l) && Number.isFinite(l) && l > 0) {
        limit = l;
      }
    }

    console.log(`listLandmarks called with bbox: west=${nums[0]}, south=${nums[1]}, east=${nums[2]}, north=${nums[3]}, limit=${limit}`);

    const data = await getByBBox({
      west: nums[0],
      south: nums[1],
      east: nums[2],
      north: nums[3],
      limit,
    });

    console.log(`getByBBox returned ${Array.isArray(data) ? data.length : (data.features ? data.features.length : 'unknown')} records`);

    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function listLandmarksByZip(req, res, next) {
  try {
    const { zip, radiusMi, limit: limitRaw } = req.query;

    if (!zip || !/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: 'Invalid or missing zip parameter' });
    }

    let r = undefined;
    if (radiusMi !== undefined) {
      r = Number(radiusMi);
      if (Number.isNaN(r) || r <= 0) {
        return res.status(400).json({ error: 'radiusMi must be a positive number.' });
      }
      const maxR = Number(process.env.ZIP_RADIUS_MI_MAX) || 20;
      if (r > maxR) {
        return res.status(400).json({ error: `radiusMi must be <= ${maxR}` });
      }
    }

    let limit = undefined;
    if (limitRaw !== undefined) {
      const l = Number(limitRaw);
      if (!Number.isNaN(l) && Number.isFinite(l) && l > 0) {
        limit = l;
      }
    }

    console.log(`listLandmarksByZip called with zip: ${zip}, radiusMi: ${r}, limit: ${limit}`);

    const data = await getByZip({ zip, radiusMi: r, limit });

    console.log(`getByZip returned ${Array.isArray(data) ? data.length : (data.features ? data.features.length : 'unknown')} records`);

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLandmarks,
  listLandmarksByZip,
};