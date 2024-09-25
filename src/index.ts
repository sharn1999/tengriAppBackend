// import connectDB from "./db";
import express from 'express';
import cors from 'cors';
import globalRouter from "./routes/global-router";



// connectDB();

const app = express();

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// const BASE_URL = "http://localhost:3000";

// const BASE_URL = "https://www.kazvision.media"

app.use(cors());

app.use(express.json());

app.use('/api', globalRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});