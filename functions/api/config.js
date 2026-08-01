import { jsonResponse } from '../_shared/apiError.js';

export const onRequestGet = ({ env }) => jsonResponse({ googleClientId: env.GOOGLE_CLIENT_ID || null });
