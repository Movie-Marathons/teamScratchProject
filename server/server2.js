const express = require('express');
const { getCinemasWithShowtimes } = require('./controllers/masterController copy.js');
const app = express();
app.get('/cinemas-with-showtimes', getCinemasWithShowtimes);
const PORT = 3009;

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
