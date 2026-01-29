// Use environment variable if available (Vite: VITE_API_URL) or fallback to localhost
const API_URL = (typeof window !== 'undefined' && window.__API_URL__) || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

let authToken = localStorage.getItem('auth_token') || null;

export const setAuthToken = (token) => {
      authToken = token;
      try { localStorage.setItem('auth_token', token); } catch (e) { }
};

export const clearAuthToken = () => {
      authToken = null;
      try { localStorage.removeItem('auth_token'); } catch (e) { }
};

const parseJSONSafe = async (res) => {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      return await res.text();
};

export const apiCall = async (method, endpoint, data = null, options = {}) => {
      const { credentials = false } = options;
      try {
            const url = `${API_URL}${endpoint}`;
            const headers = {};
            let body = null;

            // FormData (file uploads)
            if (data instanceof FormData) {
                  body = data;
            } else if (data !== null && data !== undefined) {
                  headers['Content-Type'] = 'application/json';
                  body = JSON.stringify(data);
            }

            if (authToken) {
                  headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(url, {
                  method,
                  headers,
                  credentials: credentials ? 'include' : 'same-origin',
                  body
            });

            if (!response.ok) {
                  const parsed = await parseJSONSafe(response).catch(() => ({ error: 'Unknown error' }));
                  const errMsg = (parsed && parsed.error) ? parsed.error : `API Error: ${response.status}`;
                  throw new Error(errMsg);
            }

            return await parseJSONSafe(response);
      } catch (error) {
            throw error;
      }
};

export const uploadFile = async (endpoint, file, fields = {}) => {
      const form = new FormData();
      form.append('file', file);
      Object.keys(fields || {}).forEach(k => form.append(k, fields[k]));
      return apiCall('POST', endpoint, form, { credentials: true });
};
