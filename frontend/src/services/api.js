// src/services/api.js
import axios from "axios";

// Use environment variable or fallback to production URL
const baseURL = import.meta.env.VITE_API_URL || "https://infradb-backend.onrender.com/api";

console.log("🔗 API Base URL:", baseURL); // Debug log to verify

// Base API instance
const API = axios.create({
  baseURL: baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Fetch database schema (tables + columns)
export const fetchSchema = () => API.get("/schema/");

// Fetch last 10 query history
export const fetchHistory = () => API.get("/queries/history/");

// Run SQL query (supports single or multiple statements)
export const runQuery = (sql) =>
  API.post("/queries/run/", { query: sql });

// Explain query (optional)
export const explainQuery = (sql) =>
  API.post("/queries/explain/", { query: sql });

// Save query (optional)
export const saveQuery = (payload) =>
  API.post("/queries/save/", payload);

// AI-assisted query suggestion (optional)
export const aiSuggest = (description) =>
  API.post("/ai/query_suggest/", { description });
