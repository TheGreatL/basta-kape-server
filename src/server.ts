import dotenv from 'dotenv';

// Load environment variables before importing app
dotenv.config();

import app from './app';

const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
