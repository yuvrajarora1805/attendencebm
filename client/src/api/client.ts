import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle transient boot connection errors and 401 globally
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config as any;
    if (config && (!config.__retryCount || config.__retryCount < 2)) {
      const isBootError = !err.response || [500, 502, 503, 504].includes(err.response?.status);
      if (isBootError && config.method?.toLowerCase() === 'get') {
        config.__retryCount = (config.__retryCount || 0) + 1;
        await new Promise((r) => setTimeout(r, 1200));
        return api(config);
      }
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
