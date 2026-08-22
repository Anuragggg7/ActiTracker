import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
