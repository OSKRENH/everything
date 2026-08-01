import 'dotenv/config';

const port = Number(process.env.PORT) || 4000;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
const dbPath = process.env.DB_PATH || './data/app.db';
const spoonacularApiKey = process.env.SPOONACULAR_API_KEY || '';

export const config = {
  port,
  jwtSecret,
  jwtExpiresIn,
  dbPath,
  spoonacularApiKey,
  hasSpoonacularKey: spoonacularApiKey.length > 0,
};
