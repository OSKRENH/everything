import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import './db/index.js';
import { authRouter } from './routes/auth.routes.js';
import { inventoryRouter } from './routes/inventory.routes.js';
import { recipesRouter } from './routes/recipes.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/recipes', recipesRouter);

app.use(notFound);
app.use(errorHandler);

if (!config.hasSpoonacularKey) {
  console.warn(
    'SPOONACULAR_API_KEY is not set — recipe search/detail endpoints will return 503 until it is configured.',
  );
}

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
