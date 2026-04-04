import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('infradb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const runQuery = async (sql, connectionId) => {
  const response = await api.post('/query/jobs/run/', { 
    sql, 
    connection_id: connectionId 
  });
  return response.data;
};

export const connectDB = async (config) => {
  const response = await api.post('/databases/connections/test/', config);
  return response.data;
};

export const fetchSchema = async (connectionId) => {
  const response = await api.get(`/databases/connections/${connectionId}/schema/`);
  return response.data;
};

export const getJobStatus = async (jobId) => {
  const response = await api.get(`/query/jobs/${jobId}/status/`);
  return response.data;
};

export const fetchWorkspaces = async () => {
  const response = await api.get('/databases/workspaces/');
  return response.data;
};

export const fetchQueryHistory = async (limit = 50) => {
  const response = await api.get(`/query/jobs/history/?limit=${limit}`);
  return response.data;
};

// AI Assistant APIs
export const optimizeQuery = async (sql, connectionId) => {
  const response = await api.post('/ai/optimize/', { sql, connection_id: connectionId });
  return response.data;
};

export const explainQuery = async (sql, connectionId) => {
  const response = await api.post('/ai/explain/', { sql, connection_id: connectionId });
  return response.data;
};

export const fixSyntax = async (sql, connectionId) => {
  const response = await api.post('/ai/fix-syntax/', { sql, connection_id: connectionId });
  return response.data;
};

export default api;
