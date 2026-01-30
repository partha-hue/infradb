import axiosInstance from './axios';

/**
 * Auth Services
 */
export const login = async (credentials) => {
  const response = await axiosInstance.post('/api/auth/login/', credentials);
  // Support both 'access' (JWT) and 'token' (SimpleJWT)
  const token = response.data.access || response.data.token;
  if (token) {
    localStorage.setItem('auth_token', token);
  }
  return response.data;
};

export const register = async (data) => {
  const response = await axiosInstance.post('/api/auth/register/', data);
  return response.data;
};

/**
 * Database Management Services
 */
export const getSchema = async () => {
  const response = await axiosInstance.get('/api/schema/');
  return response.data;
};

export const connectDB = async (config) => {
  const response = await axiosInstance.post('/api/connect/', config);
  return response.data;
};

export const loadSampleDB = async () => {
  const response = await axiosInstance.post('/api/load-sample-db/');
  return response.data;
};

export const listDatabases = async () => {
  const response = await axiosInstance.get('/api/databases/list/');
  return response.data;
};

/**
 * Query Engine Services
 */
export const runQuery = async (sql) => {
  const response = await axiosInstance.post('/api/queries/run/', { query: sql });
  return response.data;
};

export const getQueryHistory = async () => {
  const response = await axiosInstance.get('/api/queries/history/');
  return response.data;
};

export const explainQuery = async (sql) => {
  const response = await axiosInstance.post('/api/queries/explain/', { query: sql });
  return response.data;
};

export const suggestQuery = async (prompt) => {
  const response = await axiosInstance.post('/api/ai/query_suggest/', { prompt });
  return response.data;
};

/**
 * Data Import
 */
export const importCSV = async (file, tableName) => {
  const formData = new FormData();
  formData.append('file', file);
  if (tableName) formData.append('table_name', tableName);

  const response = await axiosInstance.post('/api/import-csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};
