const express = require('express');
const { getDailyScheduleOptions } = require('../controllers/scheduleController');
const app = express();
app.get('/schedule', getDailyScheduleOptions);
const PORT = 3000;

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
