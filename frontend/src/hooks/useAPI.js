import { useState, useCallback } from 'react';
import { apiCall } from '../services/api';

export const useAPI = () => {
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');

      const call = useCallback(async (method, endpoint, data = null) => {
            setLoading(true);
            setError('');
            try {
                  const result = await apiCall(method, endpoint, data);
                  return result;
            } catch (err) {
                  setError(err.message);
                  throw err;
            } finally {
                  setLoading(false);
            }
      }, []);

      return { call, loading, error, setError };
};
