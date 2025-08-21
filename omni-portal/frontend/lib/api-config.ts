/**
 * API Configuration for proper Docker networking
 * Handles different URLs for server-side and client-side requests
 */

export function getApiUrl(): string {
  // Check if we're on the server side
  if (typeof window === 'undefined') {
    // Server-side: Use internal Docker network
    // This allows the Next.js container to reach the backend through nginx
    return process.env.API_URL || process.env.NEXT_PRIVATE_API_URL || 'http://austa_nginx/api';
  } else {
    // Client-side: Use public URL that browser can reach
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  }
}

export function getBackendUrl(): string {
  // Direct backend URL for server-side operations
  if (typeof window === 'undefined') {
    return process.env.BACKEND_URL || 'http://austa_backend_fixed:9000';
  }
  // Should not be used on client side
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
}

export const apiConfig = {
  getUrl: getApiUrl,
  getBackendUrl: getBackendUrl,
  isServer: typeof window === 'undefined',
  isClient: typeof window !== 'undefined',
};