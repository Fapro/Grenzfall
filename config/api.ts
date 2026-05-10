/**
 * Backend base URL.
 * Override with your deployed server URL before releasing.
 * In dev: the Express backend runs on port 3001 locally.
 */
const DEV_BACKEND = 'http://localhost:3001';

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? DEV_BACKEND;
