import { useState, useCallback } from 'react';
import { runQuery, getQueryHistory } from '../api/dbService';

/**
 * Hook to manage SQL query execution, loading states, and history updates.
 */
export const useDatabase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);

  const executeQuery = useCallback(async (sql) => {
    setLoading(true);
    setError(null);
    try {
      const data = await runQuery(sql);
      setResults(data);
      // After a successful query, refresh history
      const updatedHistory = await getQueryHistory();
      setHistory(updatedHistory);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to execute query');
      setResults(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getQueryHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  return {
    executeQuery,
    fetchHistory,
    loading,
    error,
    results,
    history,
    setResults,
    setError
  };
};
