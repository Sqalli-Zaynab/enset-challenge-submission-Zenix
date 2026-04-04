const express = require('express');
const cors = require('cors');
require('dotenv').config();

const profileRoutes = require('./src/routes/profile.routes');
const careerRoutes = require('./src/routes/career.routes');
const planRoutes = require('./src/routes/plan.routes');

const app = express();

app.use(cors()); // Allows Angular frontend to communicate with Node [cite: 243]
app.use(express.json());

// API Routes as defined in the technical requirements [cite: 210, 313]
app.use('/api/profile', profileRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/plan', planRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});