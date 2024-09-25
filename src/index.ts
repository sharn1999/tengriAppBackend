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

app.use(cors({
    origin: (origin, callback) => {
      // Позволяет запросы с 'http://localhost:3001' и 'https://tengri-app.vercel.app'
      const allowedOrigins = ['http://localhost:3001', 'https://tengri-app.vercel.app'];
      if (allowedOrigins.includes(origin as string) || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }));

app.use(express.json());

app.use('/api', globalRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});