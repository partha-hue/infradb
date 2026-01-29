import axiosInstance from './axios';

/**
 * Auth Services
 */
export const login = async (credentials) => {
  const response = await axiosInstance.post('/api/auth/login/', credentials);
  if (response.data.access || response.data.token) {
    localStorage.setItem('auth_token', response.data.access || response.data.token);
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
  // config can contain { db_type: 'local' | 'cloud', ... }
  const response = await axiosInstance.post('/api/connect/', config);
  return response.data;
};

export const listDatabases = async () => {
  const response = await axiosInstance.get('/api/databases/list/');
  return response.data;
};

export const createDatabase = async (data) => {
  const response = await axiosInstance.post('/api/databases/create/', data);
  return response.data;
};

/**
 * Query Engine Services
 */
export const runQuery = async (sql) => {
  // Handling large JSON arrays is mostly about the environment/browser, 
  // but we ensure we return the data directly.
  const response = await axiosInstance.post('/api/queries/run/', { sql });
  return response.data;
};

export const getQueryHistory = async () => {
  const response = await axiosInstance.get('/api/queries/history/');
  return response.data;
};

export const explainQuery = async (sql) => {
  const response = await axiosInstance.post('/api/queries/explain/', { sql });
  return response.data;
};

/**
 * AI Assistance Services
 */
export const suggestQuery = async (prompt) => {
  const response = await axiosInstance.post('/api/ai/query_suggest/', { prompt });
  return response.data;
};

/**
 * Special Handling: File Imports
 */
export const importData = async (file, tableName) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('table_name', tableName);

  const response = await axiosInstance.post('/api/databases/import/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
