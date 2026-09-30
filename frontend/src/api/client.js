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

// Helper for opening links, downloading files, rendering iframe src or media elements across environments
export const getApiUrl = (path = '') => {
  if (!path) return '';
  if (typeof path !== 'string') return path;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  const envUrl = import.meta.env.VITE_API_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (!envUrl || envUrl === '/api') {
    return cleanPath;
  }

  const rootDomain = envUrl.replace(/\/+$/, '').replace(/\/api$/, '');

  if (cleanPath.startsWith('/api')) {
    return `${rootDomain}${cleanPath}`;
  }
  return `${rootDomain}${cleanPath}`;
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
