import { env } from './env';
import app from './app';

const port = env.PORT;

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
