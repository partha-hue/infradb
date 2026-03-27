import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('infradb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const runQuery = async (query) => {
  const response = await api.post('/run_query/', { query });
  return response.data;
};

export const connectDB = async (config) => {
  const response = await api.post('/connect/', config);
  return response.data;
};

export default api;
