import { env } from './env';
import app from './app';
import { logger } from './utils/logger';

const port = env.PORT;

app.listen(port, () => {
    logger.info(`Server is running at http://localhost:${port}`);
    logger.info(`Open http://localhost:${port}/api/docs in your browser to view the swagger documentation`);
});
