import axiosInstance from './axios';

/**
 * Auth Services
 */
export const login = async (credentials) => {
  const response = await axiosInstance.post('/api/auth/login/', credentials);
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
 * System Services
 */
export const getSystemInfo = async () => {
  const response = await axiosInstance.get('/api/system/info/');
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

export const disconnectDB = async () => {
  const response = await axiosInstance.post('/api/disconnect/');
  return response.data;
};

export const loadSampleDB = async () => {
  const response = await axiosInstance.post('/api/load-sample-db/');
  return response.data;
};

/**
 * File Ops
 */
export const importFile = async (file, tableName) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('table_name', tableName);
  const response = await axiosInstance.post('/api/import-file/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const exportData = async (query, format = 'csv') => {
  const response = await axiosInstance.post('/api/export-data/', 
    { query, format }, 
    { responseType: 'blob' }
  );
  
  // Trigger download
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `export_${Date.now()}.${format === 'excel' ? 'xlsx' : format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/**
 * Query Engine Services
 */
export const runQuery = async (sql) => {
  const response = await axiosInstance.post('/api/queries/run/', { query: sql });
  return response.data;
};

export const suggestQuery = async (prompt, action = 'generate', currentSql = '') => {
  const response = await axiosInstance.post('/api/ai/query_suggest/', { 
    prompt, 
    action, 
    current_sql: currentSql 
  });
  return response.data;
};
