import axios from 'axios';

// Resolve backend base URL from VITE_API_URL or fallback to relative '/api' for Vite dev proxy
export const getBaseUrl = () => {
  let envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return '/api';
  }
  envUrl = envUrl.replace(/\/+$/, '');
  if (envUrl === '/api') return '/api';
  if (!envUrl.endsWith('/api')) {
    return `${envUrl}/api`;
  }
  return envUrl;
};

/**
 * Derive the backend root domain from VITE_API_URL.
 * e.g. 'https://backend.onrender.com/api' → 'https://backend.onrender.com'
 * Returns '' for local dev (relative paths, handled by Vite proxy or same-origin).
 */
const getBackendRoot = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl === '/api') return '';
  return envUrl.replace(/\/+$/, '').replace(/\/api$/, '');
};

// Helper for opening links, downloading files, rendering iframe src or media elements across environments
export const getApiUrl = (path = '') => {
  if (!path) return '';
  if (typeof path !== 'string') return path;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const backendRoot = getBackendRoot();

  // In production, prepend the backend domain for upload/static paths
  if (backendRoot) {
    return `${backendRoot}${cleanPath}`;
  }

  // In local dev, relative path is fine (Vite proxy handles /uploads and /api)
  return cleanPath;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rcpit_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    let message = null;

    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        if (error.response.data.includes('<html') || error.response.data.includes('<!DOCTYPE')) {
          message = `Server Error (${error.response.status}). Please check backend service logs.`;
        } else {
          message = error.response.data;
        }
      } else if (typeof error.response.data === 'object') {
        message = error.response.data.message || error.response.data.error || error.response.data.msg;
      }
    }

    // Handle session revocation / token expiry — auto-logout and redirect to login
    if (error.response?.status === 401 && message) {
      const sessionMessages = ['Session revoked', 'Token verification failed', 'session expired', 'User not found'];
      const isSessionError = sessionMessages.some(s => message.toLowerCase().includes(s.toLowerCase()));
      const isLoginRequest = error.config?.url?.includes('/auth/login');

      if (isSessionError && !isLoginRequest) {
        console.warn('[AUTH] Session invalidated, clearing credentials and redirecting to login.');
        localStorage.removeItem('rcpit_token');
        localStorage.removeItem('rcpit_user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }
      }
    }

    if (!message) {
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || !error.response) {
        message = 'Unable to reach backend server. Please verify backend server is running on port 5000.';
      } else if (error.response?.status === 401) {
        message = 'Invalid institutional email or password. Please check your credentials.';
      } else if (error.response?.status === 403) {
        message = 'Access Denied: Your account role does not have authorization for this portal.';
      } else if (error.response?.status === 404) {
        message = 'Requested API endpoint was not found on backend server.';
      } else if (error.response?.status >= 500) {
        message = 'Backend server error or database initialization in progress. Please try again shortly.';
      } else {
        message = error.message || 'An unexpected error occurred. Please try again.';
      }
    }

    const customError = new Error(message);
    customError.response = error.response;
    customError.status = error.response?.status;
    customError.code = error.code;
    customError.originalError = error;

    return Promise.reject(customError);
  }
);

export default api;
