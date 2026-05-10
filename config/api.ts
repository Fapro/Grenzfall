import { Platform } from 'react-native';

/**
 * Backend base URL.
 * Override with your deployed server URL before releasing.
 * In dev: the Express backend runs on port 3001 locally.
 */
const DEV_BACKEND =
  Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

const EXPLICIT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

function getWebBackendUrl(): string {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return 'http://localhost:3001';
  }
  return `http://${window.location.hostname}:3001`;
}

export const BACKEND_URL =
  EXPLICIT_BACKEND_URL && EXPLICIT_BACKEND_URL.length > 0
    ? EXPLICIT_BACKEND_URL
    : Platform.OS === 'web'
      ? getWebBackendUrl()
      : DEV_BACKEND;
