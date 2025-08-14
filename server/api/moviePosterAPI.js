const { MG_CLIENT, MG_API_KEY, MG_AUTH, MG_TERRITORY, MG_API_VERSION, MG_GEO } = process.env;

const baseHeaders = {
  client: process.env.MG_CLIENT || '',
  'x-api-key': process.env.MG_API_KEY || '',
  Authorization: process.env.MG_AUTH || '',
  territory: process.env.MG_TERRITORY || 'US',
  'api-version': process.env.MG_API_VERSION || 'v201',
  'user-agent': process.env.MG_USER_AGENT || 'MovieGluTestApp',
  Accept: 'application/json',
};

const axios = require('axios');

const MOVIEGLU_BASE_URL = 'https://api.movieglu.com/';

const movieGluClient = axios.create({
  baseURL: MOVIEGLU_BASE_URL,
  headers: baseHeaders,
});

async function getImages({ film_id, size_category, orientation } = {}) {
  if (!film_id) {
    throw new Error('film_id is required');
  }

  const params = { film_id };

  if (size_category) {
    params.size_category = size_category;
  }

  if (orientation) {
    params.orientation = orientation;
  }

  try {
    const response = await movieGluClient.get('images/', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching images from MovieGlu API:', error.message);
    throw new Error(`Failed to fetch images: ${error.message}`);
  }
}

module.exports = {
  getImages,
  movieGluClient,
};
