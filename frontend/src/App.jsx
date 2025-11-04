import React, { useEffect, useRef, useState } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import axios from "axios";
import { ResizableBox } from "react-resizable";
import ReactFlow, { MiniMap, Controls, Background } from "reactflow";
import "reactflow/dist/style.css";
import "react-resizable/css/styles.css";

import {
  FaDatabase,
  FaPlay,
  FaTable,
  FaHistory,
  FaCircle,
  FaSpinner,
  FaDownload,
  FaPlus,
  FaRobot,
  FaTimes,
  FaFileImport,
  FaProjectDiagram,
  FaSync,
  FaMoon,
  FaSun,
  FaSave,
  FaCog,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaChartArea,
  FaCamera,
  FaFilter,
  FaCalculator,
  FaSearch,
  FaBrain,
  FaFileExport,
  FaClock,
  FaUser,
  FaSignOutAlt,
  FaSignInAlt,
  FaShieldAlt,
  FaLock,
  FaUnlock,
  FaBell,
  FaCheckCircle,
  FaExclamationTriangle,
  FaLightbulb,
  FaShare,
  FaComment,
  FaBookmark,
  FaFileCode,
} from "react-icons/fa";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
} from "recharts";

// API URL detection - simple, no hooks needed
const BASE = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.electron
    ? "http://127.0.0.1:8000/api"
    : "https://infradb-backend.onrender.com/api");

console.log('🌐 API Base URL:', BASE);
console.log('🖥️ Running in Electron:', !!(typeof window !== 'undefined' && window.electron));

const defaultSettings = {
  editorFontSize: 14,
  darkMode: true,
  editorMinimap: false,
  tabSize: 2,
  lineNumbers: true,
  wordWrap: "on",
  autoSave: true,
  showNotifications: true,
  enableQuerySharing: true,
  keyboardShortcuts: true,
};

// Toast notification system
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: colors[type] || colors.info,
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 300,
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <div style={{ flex: 1 }}>{message}</div>
      <FaTimes
        onClick={onClose}
        style={{ cursor: "pointer", opacity: 0.8 }}
      />
    </div>
  );
};

// Enhanced color palette for charts
const CHART_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c7c",
  "#8dd1e1",
  "#d084d0",
  "#ffb347",
  "#a4de6c",
];

export default function App() {
  const [tabs, setTabs] = useState([
    {
      id: "tab-1",
      title: "Query 1",
      content: "-- Write your SQL here",
      language: "sql",
      isER: false,
      isDashboard: false,
      isSettings: false,
      isAnalytics: false,
      savedQuery: null,
      sharedWith: [],
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [results, setResults] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [connected, setConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [dbType, setDbType] = useState("sqlite");
  const [tables, setTables] = useState([]);
  const [tablesInfo, setTablesInfo] = useState([]);
  const [history, setHistory] = useState([]);

  // Connection modal state
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionFields, setConnectionFields] = useState({
    database: 'mydb.db',
    host: '',
    port: '',
    user: '',
    password: ''
  });


  // Query performance tracking
  const [queryPerformance, setQueryPerformance] = useState([]);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("user"); // "admin" | "user"
  const [authToken, setAuthToken] = useState(null);

  // Production features state
  const [toasts, setToasts] = useState([]);
  const [savedQueries, setSavedQueries] = useState([]);
  const [queryExplanation, setQueryExplanation] = useState(null);
  const [slowQueryWarning, setSlowQueryWarning] = useState(false);
  const [indexRecommendations, setIndexRecommendations] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Excel import state
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if not in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'l':
            e.preventDefault();
            loadSampleDB();
            break;
          case 'i':
            e.preventDefault();
            setShowExcelImport(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyboard shortcuts help
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Settings state
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("inframinddb_settings");
      if (saved) return JSON.parse(saved);
    } catch { }
    return defaultSettings;
  });

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only process if keyboard shortcuts are enabled
      if (!appSettings.keyboardShortcuts) return;

      // Toggle Shortcuts Help with '?'
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
      }

      // Ctrl/Cmd + Enter: Run Query
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunQuery();
      }

      // Ctrl/Cmd + S: Save Query
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveQuery();
      }

      // Ctrl/Cmd + N: New Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleAddTab();
      }

      // Ctrl/Cmd + W: Close Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        handleCloseTab(activeTabId);
      }

      // Ctrl/Cmd + F: Find/Replace
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
      }

      // Ctrl/Cmd + L: Load Sample DB
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        handleLoadSampleDB();
      }

      // Ctrl/Cmd + I: Import Excel
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        handleImportExcel();
      }

      // Ctrl/Cmd + E: Generate ER Diagram
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleGenerateERDiagram();
      }

      // Ctrl/Cmd + /: Explain Query
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        handleExplainQuery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appSettings.keyboardShortcuts, activeTabId]);


  const [darkMode, setDarkMode] = useState(appSettings.darkMode ?? true);

  const [aiOpen, setAiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const [leftWidth, setLeftWidth] = useState(320);
  const [historyHeight, setHistoryHeight] = useState(180);
  const [rightWidth, setRightWidth] = useState(360);
  const [editorHeightPct, setEditorHeightPct] = useState(55);
  const [device, setDevice] = useState("desktop");

  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const chatEndRef = useRef(null);

  const monaco = useMonaco();

  // Sync darkMode with appSettings changes
  useEffect(() => {
    setDarkMode(appSettings.darkMode);
  }, [appSettings.darkMode]);

  useEffect(() => {
    (async () => {
      // Check for existing auth token
      const savedToken = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("current_user");
      if (savedToken && savedUser) {
        setAuthToken(savedToken);
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
        axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
      }

      await loadSchema().catch(() => { });
      await loadHistory().catch(() => { });
      loadPerformanceHistory();
      loadSavedQueries();
    })();

    const detect = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");

      if (w < 900) {
        setLeftWidth(200);
        setRightWidth(300);
      }
    };
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  async function connectDatabaseInteractive() {
    try {
      // SQLite - simple file-based database
      if (dbType === 'sqlite') {
        // Show modal for SQLite database name
        setConnectionFields({ database: 'mydb.db', host: '', port: '', user: '', password: '' });
        setShowConnectionModal(true);
        return; // Modal will handle the connection
      }
      // MySQL/PostgreSQL - need full credentials
      else {
        setMessage(`Please provide ${dbType.toUpperCase()} credentials...`);

        // Set default values for MySQL/PostgreSQL
        setConnectionFields({
          database: '',
          host: '',
          port: dbType === "mysql" ? "3306" : "5432",
          user: dbType === "mysql" ? "root" : "postgres",
          password: ''
        });
        setShowConnectionModal(true);
        return; // Modal will handle the connection
      }
    } catch (err) {
      setConnected(false);
      setMessage(`❌ ${err.message}`);
      console.error("Connection error:", err);
    }
  }

  // Actual connection function (called from modal)
  async function performConnection(fields) {
    try {
      const creds = { db_type: dbType };

      if (dbType === 'sqlite') {
        if (!fields.database) {
          setMessage("⚠️ Database name required");
          return;
        }
        creds.database = fields.database;
        setMessage("Connecting to SQLite...");
      } else {
        // Validate required fields
        if (!fields.host) {
          setMessage("⚠️ Host is required");
          return;
        }

        // Block localhost
        if (fields.host === 'localhost' || fields.host === '127.0.0.1' || fields.host === '::1') {
          setMessage("❌ Localhost connection blocked - use cloud database");
          showToast('⚠️ LOCALHOST NOT SUPPORTED IN PRODUCTION\n\nUse cloud database:\n• MySQL: PlanetScale, Railway\n• PostgreSQL: Render, Supabase', 'warning');
          return;
        }

        if (!fields.database) {
          setMessage("⚠️ Database name required");
          return;
        }

        creds.host = fields.host.trim();
        creds.port = fields.port || (dbType === "mysql" ? "3306" : "5432");
        creds.user = fields.user || (dbType === "mysql" ? "root" : "postgres");
        creds.password = fields.password;
        creds.database = fields.database.trim();

        setMessage(`Connecting to ${dbType.toUpperCase()} at ${creds.host}...`);
      }

      // Attempt connection
      const res = await axios.post(`${BASE}/connect/`, creds);

      // Check for success
      if (res.status === 200 && (res.data?.success || res.data?.ok || res.data?.message)) {
        setConnected(true);
        setConnectionInfo(creds);
        const successMsg = res.data?.message || `✅ Connected to ${dbType} database`;
        setMessage(successMsg);

        // ✅ FIX: Close modal and reset fields
        setShowConnectionModal(false);
        setConnectionFields({
          database: 'mydb.db',
          host: '',
          port: '',
          user: '',
          password: ''
        });

        // Load database schema
        await loadSchema();

        // ✅ FIX: Show success toast
        showToast(successMsg, 'success');
      } else {
        setConnected(false);
        setMessage("❌ Connection failed - check credentials");
        showToast("❌ Connection failed - check credentials", 'error');
      }
    } catch (err) {
      setConnected(false);

      // Extract error message
      let errorMsg = "Unknown error";
      if (err?.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err?.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.message) {
        errorMsg = err.message;
      }

      setMessage(`❌ ${errorMsg}`);
      showToast(`❌ ${errorMsg}`, 'error');
      console.error("Connection error details:", err.response?.data || err);
    }
  }


  async function loadSampleDB() {
    try {
      setMessage("Loading sample database...");
      const res = await axios.post(`${BASE}/load-sample-db/`);
      if (res.status === 200 && res.data?.ok) {
        showToast("Sample database loaded", "success");
        setConnected(true);
        setConnectionInfo({ type: "sqlite", database: res.data.path || "sample_db.sqlite3" });
        await loadSchema();
        setMessage("Sample DB connected");
      } else {
        showToast("Failed to load sample DB", "error");
        setMessage("Failed to load sample DB");
      }
    } catch (err) {
      showToast("Load sample DB failed: " + (err?.response?.data?.error || err.message), "error");
      setMessage("Load sample DB failed: " + (err?.response?.data?.error || err.message));
      setConnected(false);
    }
  }

  async function disconnectDatabase() {
    try {
      await axios.post(`${BASE}/disconnect/`);
    } catch { }
    setConnected(false);
    setConnectionInfo(null);
    setMessage("Disconnected");
  }

  async function loadSchema() {
    try {
      const res = await axios.get(`${BASE}/schema/`);
      const t = res.data.tables || [];
      const normalized = t.map((x) => ({
        name: x.name,
        columns: x.columns || [],
      }));
      setTables(normalized.map((x) => x.name));
      setTablesInfo(normalized);
      setMessage("Schema loaded");
      setConnected(true);
    } catch (err) {
      setTables([]);
      setTablesInfo([]);
      setMessage(
        "⚠️ Could not load schema: " +
        (err?.response?.data?.error || err.message)
      );
      setConnected(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await axios.get(`${BASE}/queries/history/`);
      if (Array.isArray(res.data)) setHistory(res.data.reverse());
    } catch {
      setHistory([]);
    }
  }

  function loadPerformanceHistory() {
    try {
      const saved = localStorage.getItem("query_performance");
      if (saved) {
        setQueryPerformance(JSON.parse(saved));
      }
    } catch { }
  }

  function savePerformanceMetric(query, duration, rowCount) {
    const metric = {
      query: query.substring(0, 100),
      duration,
      rowCount,
      timestamp: new Date().toISOString(),
    };
    const updated = [metric, ...queryPerformance.slice(0, 99)];
    setQueryPerformance(updated);
    try {
      localStorage.setItem("query_performance", JSON.stringify(updated));
    } catch { }
  }

  async function run(currentQuery) {
    const q = currentQuery || getActiveContent();
    if (!q || !q.trim()) {
      showToast("⚠️ Query is empty!", "warning");
      return;
    }

    // Check for dangerous operations if user is not admin
    if (userRole !== "admin" && /DROP|DELETE|TRUNCATE|ALTER/i.test(q)) {
      showToast("🔒 DDL/DML operations require admin privileges", "error");
      return;
    }

    setLoading(true);
    setResults([]);
    setMessage("");
    setSlowQueryWarning(false);

    const startTime = performance.now();

    try {
      const payload = {
        query: q,
        connection: connectionInfo,
        explain: appSettings.autoExplain
      };

      const res = await axios.post(`${BASE}/queries/run/`, payload, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Slow query detection
      if (duration > 1000) {
        setSlowQueryWarning(true);
        showToast(`⚠️ Slow query detected: ${duration.toFixed(0)}ms. Consider adding indexes.`, "warning");
        fetchIndexRecommendations(q);
      }

      if (res.data?.results) {
        setResults(res.data.results);
        setLastResult(res.data.results[0] || null);

        const rowCount = res.data.results[0]?.rows?.length || 0;
        savePerformanceMetric(q, duration, rowCount);

        // Check for query explanation
        if (res.data.explanation) {
          setQueryExplanation(res.data.explanation);
        }

        showToast(
          `✅ Executed ${res.data.results.length} statement(s) in ${duration.toFixed(2)}ms`,
          "success"
        );
        loadHistory();

        // Auto-save if enabled
        if (appSettings.autoSave) {
          autoSaveQuery(q);
        }
      } else {
        setResults([]);
        setLastResult(null);
        showToast(`✅ Query executed in ${duration.toFixed(2)}ms (no results returned).`, "success");
      }
      setConnected(true);
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err.message;
      showToast("🚨 " + errorMsg, "error");
      setMessage("🚨 " + errorMsg);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  // Toast notification helper
  function showToast(message, type = "info") {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  // Authentication functions
  async function login(username, password) {
    try {
      const res = await axios.post(`${BASE}/auth/login/`, { username, password });
      const { token, user } = res.data;

      setAuthToken(token);
      setCurrentUser(user);
      setIsAuthenticated(true);
      setUserRole(user.role || "user");

      localStorage.setItem("auth_token", token);
      localStorage.setItem("current_user", JSON.stringify(user));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      showToast(`Welcome back, ${user.username}!`, "success");
      setShowAuthModal(false);
    } catch (err) {
      showToast("Login failed: " + (err?.response?.data?.error || err.message), "error");
    }
  }

  function logout() {
    setAuthToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUserRole("user");

    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    delete axios.defaults.headers.common["Authorization"];

    showToast("Logged out successfully", "info");
  }

  // Save query functionality
  async function saveQuery(queryText, title, isPublic = false) {
    try {
      const res = await axios.post(`${BASE}/queries/save/`, {
        title,
        query: queryText,
        is_public: isPublic,
      });

      showToast("✅ Query saved successfully", "success");
      loadSavedQueries();
    } catch (err) {
      showToast("Failed to save query", "error");
    }
  }

  async function loadSavedQueries() {
    try {
      const res = await axios.get(`${BASE}/queries/saved/`);
      setSavedQueries(res.data || []);
    } catch (err) {
      console.error("Failed to load saved queries", err);
    }
  }

  function autoSaveQuery(queryText) {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // Save to localStorage as backup
    try {
      const autoSaved = JSON.parse(localStorage.getItem("autosaved_queries") || "{}");
      autoSaved[activeTabId] = {
        query: queryText,
        timestamp: new Date().toISOString(),
        title: activeTab.title,
      };
      localStorage.setItem("autosaved_queries", JSON.stringify(autoSaved));
    } catch (err) {
      console.error("Auto-save failed", err);
    }
  }

  // Index recommendations
  async function fetchIndexRecommendations(query) {
    try {
      const res = await axios.post(`${BASE}/queries/recommend-indexes/`, { query });
      if (res.data?.recommendations) {
        setIndexRecommendations(res.data.recommendations);
        showToast(`💡 ${res.data.recommendations.length} index recommendations available`, "info");
      }
    } catch (err) {
      console.error("Failed to fetch index recommendations", err);
    }
  }

  // Query explanation
  async function explainQuery(query) {
    try {
      const res = await axios.post(`${BASE}/queries/explain/`, { query });
      if (res.data?.plan) {
        setQueryExplanation(res.data.plan);
        showToast("✅ Query execution plan loaded", "success");
      }
    } catch (err) {
      showToast("Failed to explain query", "error");
    }
  }

  // Tab helpers
  function addTab(title = null, opts = {}) {
    const id = `tab-${Date.now()}`;
    const titleTxt = title || `Query ${tabs.length + 1}`;
    setTabs((prev) => [
      ...prev,
      {
        id,
        title: titleTxt,
        content: "",
        language: "sql",
        isER: false,
        isDashboard: false,
        isSettings: false,
        isAnalytics: false,
        ...opts,
      },
    ]);
    setActiveTabId(id);
  }

  function closeTab(id) {
    if (tabs.length === 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      const next = newTabs[Math.max(0, idx - 1)];
      setActiveTabId(next.id);
    }
    // If close settings tab, save settings to localStorage
    const closedTab = tabs.find((t) => t.id === id);
    if (closedTab?.isSettings) {
      try {
        localStorage.setItem(
          "inframinddb_settings",
          JSON.stringify(appSettings)
        );
      } catch { }
    }
  }

  function updateTabContent(id, content) {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content } : t)));
  }

  function getActiveContent() {
    const a = tabs.find((t) => t.id === activeTabId);
    return a ? a.content : "";
  }

  function setActiveContent(text) {
    updateTabContent(activeTabId, text);
  }

  // Open or create settings tab
  function openSettingsTab() {
    const existing = tabs.find((t) => t.isSettings);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const settingsContent = JSON.stringify(appSettings, null, 2);
      const id = `settings-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        {
          id,
          title: "⚙️ Settings",
          content: settingsContent,
          language: "json",
          isER: false,
          isDashboard: false,
          isSettings: true,
          isAnalytics: false,
        },
      ]);
      setActiveTabId(id);
    }
  }

  function openAnalyticsTab() {
    const existing = tabs.find((t) => t.isAnalytics);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const id = `analytics-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        {
          id,
          title: "📊 Advanced Analytics",
          content: "",
          language: "analytics",
          isER: false,
          isDashboard: false,
          isSettings: false,
          isAnalytics: true,
        },
      ]);
      setActiveTabId(id);
    }
  }

  async function generateERDiagram() {
    try {
      setMessage("Generating ER diagram...");
      const res = await axios.get(`${BASE}/er-diagram/`);
      if (res.data?.tables) {
        const existing = tabs.find((t) => t.isER);
        if (existing) {
          updateTabContent(existing.id, JSON.stringify(res.data, null, 2));
          setActiveTabId(existing.id);
        } else {
          const id = `er-${Date.now()}`;
          setTabs((prev) => [
            ...prev,
            {
              id,
              title: "ER Diagram",
              content: JSON.stringify(res.data, null, 2),
              language: "json",
              isER: true,
              isDashboard: false,
              isSettings: false,
              isAnalytics: false,
            },
          ]);
          setActiveTabId(id);
        }
        setMessage("ER diagram loaded in ER tab.");
      } else {
        setMessage("No ER data returned.");
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error || err.message || "Unknown error";
      showToast("ER generation failed: " + errMsg, "error");
      setMessage("ER generation failed: " + errMsg);
    }
  }

  function openDashboardTab() {
    const existing = tabs.find((t) => t.isDashboard);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const id = `dash-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        {
          id,
          title: "📊 Dashboard",
          content: "",
          language: "dashboard",
          isER: false,
          isDashboard: true,
          isSettings: false,
          isAnalytics: false,
        },
      ]);
      setActiveTabId(id);
    }
  }

  // AI functions
  const askAI = async () => {
    let promptText = aiPrompt;
    if (
      /check|correct|fix|improve/i.test(promptText) &&
      /editor/i.test(promptText)
    ) {
      const currentSQL = getActiveContent() || "";
      promptText = `${promptText}\n\nCurrent Editor SQL:\n${currentSQL}`;
    }
    if (!promptText.trim()) return;
    setAiMessages((p) => [...p, { type: "user", text: promptText }]);
    setAiPrompt("");
    setAiLoading(true);
    try {
      const res = await axios.post(`${BASE}/ai/query_suggest/`, {
        query: promptText,
      });
      const sql = res.data?.sql || res.data?.sql_query || "-- No SQL generated";
      const explanation = res.data?.explanation || "";
      setAiMessages((p) => [
        ...p,
        { type: "ai", sql, explanation, hasAccept: true },
      ]);
    } catch (err) {
      setAiMessages((p) => [
        ...p,
        {
          type: "ai",
          text: "🚨 " + (err?.response?.data?.error || err.message),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  function newChat() {
    setAiMessages([]);
    setAiPrompt("");
  }

  function acceptSqlToEditor(sqlText) {
    let extract = sqlText;
    const codeMatch = sqlText.match(/```sql([\s\S]*?)```/i);
    if (codeMatch) extract = codeMatch[1].trim();
    const sqlCommands = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/im;
    let lines = extract.split("\n").map((line) => line.trim());
    const startIdx = lines.findIndex((line) => sqlCommands.test(line));
    if (startIdx !== -1) lines = lines.slice(startIdx);
    while (lines.length && !sqlCommands.test(lines[lines.length - 1]))
      lines.pop();
    extract = lines.join("\n").trim();
    setActiveContent(extract);
    setAiMessages((p) => [
      ...p,
      { type: "user", text: "✅ SQL accepted into editor." },
    ]);
    try {
      editorRef.current?.focus();
    } catch { }
  }

  function exportCsv() {
    if (!lastResult) return;
    const r = lastResult;
    const cols = r.columns || [];
    const rows = r.rows || [];
    const csv = [cols.join(",")]
      .concat(
        rows.map((row) =>
          row.map((v) => `"${(v ?? "") + ""}"`).join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_result.csv";
    a.click();
  }

  function importCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const tableName = prompt(
      "Enter table name (leave blank to use filename):",
      ""
    );
    if (tableName && tableName.trim()) {
      formData.append("table_name", tableName.trim());
    }

    setMessage("📤 Uploading CSV...");
    setLoading(true);

    axios
      .post(`${BASE}/import-csv/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .then((res) => {
        setMessage(res.data.message || "✅ CSV imported successfully");
        loadSchema();

        const newTableName = res.data.table_name;
        if (newTableName) {
          const id = `tab-${Date.now()}`;
          setTabs((prev) => [
            ...prev,
            {
              id,
              title: `Query ${newTableName}`,
              content: `-- Query imported table\nSELECT * FROM ${newTableName} LIMIT 100;`,
              language: "sql",
              isER: false,
              isDashboard: false,
              isSettings: false,
              isAnalytics: false,
            },
          ]);
          setActiveTabId(id);
        }
      })
      .catch((err) => {
        setMessage(
          "❌ CSV import failed: " +
          (err?.response?.data?.error || err.message)
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function extractTablesFromQuery(sql) {
    if (!sql) return [];
    const regex =
      /\bfrom\s+([`"]?)([a-zA-Z0-9_]+)\1|join\s+([`"]?)([a-zA-Z0-9_]+)\3/gi;
    const tablesFound = new Set();
    let match;
    while ((match = regex.exec(sql.toLowerCase())) !== null) {
      const t = match[2] || match[4];
      if (t) tablesFound.add(t);
    }
    return Array.from(tablesFound);
  }

  function renderSettingsTab() {
    return (
      <div
        style={{
          height: "100%",
          background: darkMode ? "#071021" : "#fff",
          color: darkMode ? "#e6eef6" : "#111",
          padding: 24,
          overflowY: "auto",
        }}
      >
        <h2 style={{ marginBottom: 24 }}>⚙️ Editor / IDE Settings</h2>

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Editor Font Size: {appSettings.editorFontSize}px
          </label>
          <input
            type="range"
            min={10}
            max={24}
            value={appSettings.editorFontSize}
            onChange={(e) =>
              setAppSettings((prev) => {
                const updated = {
                  ...prev,
                  editorFontSize: parseInt(e.target.value, 10),
                };
                updateTabContent(activeTabId, JSON.stringify(updated, null, 2));
                localStorage.setItem(
                  "inframinddb_settings",
                  JSON.stringify(updated)
                );
                return updated;
              })
            }
            style={{ width: "100%", maxWidth: 400 }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={appSettings.darkMode}
              onChange={(e) =>
                setAppSettings((prev) => {
                  const updated = { ...prev, darkMode: e.target.checked };
                  updateTabContent(
                    activeTabId,
                    JSON.stringify(updated, null, 2)
                  );
                  localStorage.setItem(
                    "inframinddb_settings",
                    JSON.stringify(updated)
                  );
                  return updated;
                })
              }
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 600 }}>Use Dark Mode</span>
          </label>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={!!appSettings.editorMinimap}
              onChange={(e) =>
                setAppSettings((prev) => {
                  const updated = { ...prev, editorMinimap: e.target.checked };
                  updateTabContent(
                    activeTabId,
                    JSON.stringify(updated, null, 2)
                  );
                  localStorage.setItem(
                    "inframinddb_settings",
                    JSON.stringify(updated)
                  );
                  return updated;
                })
              }
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 600 }}>Show Editor Minimap</span>
          </label>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={!!appSettings.lineNumbers}
              onChange={(e) =>
                setAppSettings((prev) => {
                  const updated = { ...prev, lineNumbers: e.target.checked };
                  updateTabContent(
                    activeTabId,
                    JSON.stringify(updated, null, 2)
                  );
                  localStorage.setItem(
                    "inframinddb_settings",
                    JSON.stringify(updated)
                  );
                  return updated;
                })
              }
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 600 }}>Show Line Numbers</span>
          </label>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={!!appSettings.keyboardShortcuts}
              onChange={(e) =>
                setAppSettings((prev) => {
                  const updated = { ...prev, keyboardShortcuts: e.target.checked };
                  updateTabContent(
                    activeTabId,
                    JSON.stringify(updated, null, 2)
                  );
                  localStorage.setItem(
                    "inframinddb_settings",
                    JSON.stringify(updated)
                  );
                  return updated;
                })
              }
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 600 }}>Enable Keyboard Shortcuts</span>
          </label>

          {appSettings.keyboardShortcuts && (
            <div style={{
              marginTop: 10,
              padding: 12,
              background: darkMode ? "#0f172a" : "#f3f4f6",
              borderRadius: 6,
              fontSize: 13
            }}>
              <h4 style={{ marginTop: 0, marginBottom: 8 }}>Available Shortcuts:</h4>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li style={{ marginBottom: 4 }}><strong>?</strong>: Toggle Shortcuts Help</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+Enter</strong>: Run Query</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+S</strong>: Save Query</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+N</strong>: New Tab</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+W</strong>: Close Tab</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+F</strong>: Find/Replace</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+L</strong>: Load Sample DB</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+I</strong>: Import Excel</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+E</strong>: Generate ER Diagram</li>
                <li style={{ marginBottom: 4 }}><strong>Ctrl+/</strong>: Explain Query</li>
              </ul>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Word Wrap
          </label>
          <select
            value={appSettings.wordWrap || "on"}
            onChange={(e) =>
              setAppSettings((prev) => {
                const updated = { ...prev, wordWrap: e.target.value };
                updateTabContent(activeTabId, JSON.stringify(updated, null, 2));
                localStorage.setItem(
                  "inframinddb_settings",
                  JSON.stringify(updated)
                );
                return updated;
              })
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
              background: darkMode ? "#0f172a" : "#fff",
              color: darkMode ? "#e6eef6" : "#111",
              fontSize: 14,
            }}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
            <option value="wordWrapColumn">Word Wrap Column</option>
            <option value="bounded">Bounded</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Tab Size: {appSettings.tabSize}
          </label>
          <input
            type="range"
            min={2}
            max={8}
            value={appSettings.tabSize || 2}
            onChange={(e) =>
              setAppSettings((prev) => {
                const updated = {
                  ...prev,
                  tabSize: parseInt(e.target.value, 10),
                };
                updateTabContent(activeTabId, JSON.stringify(updated, null, 2));
                localStorage.setItem(
                  "inframinddb_settings",
                  JSON.stringify(updated)
                );
                return updated;
              })
            }
            style={{ width: "100%", maxWidth: 400 }}
          />
        </div>

        <div
          style={{
            marginTop: 40,
            padding: 16,
            background: darkMode ? "#0f172a" : "#f3f4f6",
            borderRadius: 8,
            fontSize: 13,
            color: darkMode ? "#94a3ad" : "#6b7280",
          }}
        >
          ℹ️ Settings are saved automatically and applied in real-time to all
          editor tabs.
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <div
      ref={containerRef}
      style={{
        height: "100vh",
        display: "flex",
        fontFamily: "Inter, system-ui, Arial",
        background: darkMode ? "#0b1220" : "#f6f8fb",
        color: darkMode ? "#e6eef6" : "#111",
      }}
    >
      {/* Toast Notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {/* Toast Notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {/* Connection Modal */}
      {showConnectionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: darkMode ? '#1e293b' : '#fff',
            padding: '32px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            minWidth: '400px',
            maxWidth: '500px',
            color: darkMode ? '#e6eef6' : '#111'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px' }}>
              {dbType === 'sqlite' ? 'SQLite Database' : `${dbType.toUpperCase()} Connection`}
            </h2>

            {dbType === 'sqlite' ? (
              // SQLite form
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Database Name:
                </label>
                <input
                  type="text"
                  value={connectionFields.database}
                  onChange={(e) => setConnectionFields({ ...connectionFields, database: e.target.value })}
                  placeholder="mydb.db"
                  style={{
                    marginBottom: '16px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                    background: darkMode ? '#0f172a' : '#fff',
                    color: darkMode ? '#e6eef6' : '#111'
                  }}
                  autoFocus
                />
              </div>
            ) : (
              // MySQL/PostgreSQL form
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Host:
                  </label>
                  <input
                    type="text"
                    value={connectionFields.host}
                    onChange={(e) => setConnectionFields({ ...connectionFields, host: e.target.value })}
                    placeholder="database.example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                      background: darkMode ? '#0f172a' : '#fff',
                      color: darkMode ? '#e6eef6' : '#111'
                    }}
                    autoFocus
                  />
                  <small style={{ color: darkMode ? '#94a3ad' : '#6b7280', fontSize: '12px' }}>
                    Use public cloud host (not localhost)
                  </small>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Port:
                  </label>
                  <input
                    type="text"
                    value={connectionFields.port}
                    onChange={(e) => setConnectionFields({ ...connectionFields, port: e.target.value })}
                    placeholder={dbType === "mysql" ? "3306" : "5432"}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                      background: darkMode ? '#0f172a' : '#fff',
                      color: darkMode ? '#e6eef6' : '#111'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Username:
                  </label>
                  <input
                    type="text"
                    value={connectionFields.user}
                    onChange={(e) => setConnectionFields({ ...connectionFields, user: e.target.value })}
                    placeholder={dbType === "mysql" ? "root" : "postgres"}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                      background: darkMode ? '#0f172a' : '#fff',
                      color: darkMode ? '#e6eef6' : '#111'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Password:
                  </label>
                  <input
                    type="password"
                    value={connectionFields.password}
                    onChange={(e) => setConnectionFields({ ...connectionFields, password: e.target.value })}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                      background: darkMode ? '#0f172a' : '#fff',
                      color: darkMode ? '#e6eef6' : '#111'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Database Name:
                  </label>
                  <input
                    type="text"
                    value={connectionFields.database}
                    onChange={(e) => setConnectionFields({ ...connectionFields, database: e.target.value })}
                    placeholder="mydb"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                      background: darkMode ? '#0f172a' : '#fff',
                      color: darkMode ? '#e6eef6' : '#111'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => performConnection(connectionFields)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#10b981',
                  color: '#fff',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                Connect
              </button>
              <button
                onClick={() => setShowConnectionModal(false)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: darkMode ? '#374151' : '#e5e7eb',
                  color: darkMode ? '#e6eef6' : '#111',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Authentication Modal */}
      {showAuthModal && (
        <AuthModal
          darkMode={darkMode}
          onLogin={login}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Index Recommendations Panel */}
      {indexRecommendations.length > 0 && (
        <IndexRecommendationsPanel
          recommendations={indexRecommendations}
          darkMode={darkMode}
          onClose={() => setIndexRecommendations([])}
          onApply={(sql) => {
            setActiveContent(sql);
            showToast("Index creation SQL added to editor", "success");
          }}
        />
      )}

      {/* Query Explanation Panel */}
      {queryExplanation && (
        <QueryExplanationPanel
          explanation={queryExplanation}
          darkMode={darkMode}
          onClose={() => setQueryExplanation(null)}
        />
      )}
      {/* Sidebar */}
      <ResizableBox
        width={leftWidth}
        height={window.innerHeight}
        axis="x"
        minConstraints={[160, window.innerHeight]}
        maxConstraints={[520, window.innerHeight]}
        onResizeStop={(e, data) => setLeftWidth(data.size.width)}
      >
        <div
          style={{
            width: leftWidth,
            background: darkMode ? "#071021" : "#fff",
            height: "100vh",
            borderRight: "1px solid rgba(255,255,255,0.03)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
              title="InframindDB Logo"
            >
              <FaDatabase />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>InframindDB</div>
              <div
                style={{ fontSize: 12, color: darkMode ? "#9aa3ad" : "#6b7280" }}
              >
                Query IDE Pro
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "8px 12px",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <FaCircle
              style={{ color: connected ? "#16a34a" : "#ef4444" }}
              title={connected ? "Connected" : "Disconnected"}
            />
            <div style={{ fontSize: 13 }}>
              {connected ? `Connected (${dbType})` : "Disconnected"}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                onClick={() =>
                  connected
                    ? disconnectDatabase()
                    : connectDatabaseInteractive()
                }
                style={{
                  padding: "6px 10px",
                  background: "#0b1220",
                  color: "#e6eef6",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                title={
                  connected
                    ? "Disconnect from database"
                    : "Connect to database"
                }
              >
                {connected ? "Disconnect" : "Connect"}
              </button>
              {/* Moved Sample DB and Import buttons to top toolbar */}
            </div>
          </div>
          {showExcelImport && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
                  padding: '20px',
                  borderRadius: '8px',
                  width: '400px',
                }}
              >
                <h3 style={{ marginTop: 0, color: darkMode ? '#e6eef6' : '#0f172a' }}>Import Excel File</h3>
                <p style={{ color: darkMode ? '#94a3b8' : '#475569', fontSize: '14px' }}>
                  Select an Excel file (.xlsx, .xls) to import into the current database.
                  A new table will be created based on the Excel structure.
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append('file', file);

                    setExcelUploading(true);
                    setMessage("Uploading Excel file...");

                    axios.post(`${BASE}/import-excel/`, formData, {
                      headers: {
                        'Content-Type': 'multipart/form-data',
                      }
                    })
                      .then(response => {
                        if (response.status === 200) {
                          setMessage(`✅ ${response.data.message}`);
                          loadSchema();

                          // Add a query to view the imported data
                          const newTab = {
                            id: `tab-${Date.now()}`,
                            title: "Imported Data",
                            content: `SELECT * FROM ${response.data.table_name} LIMIT 100;`,
                            language: "sql",
                            isER: false,
                            isDashboard: false,
                            isSettings: false,
                            isAnalytics: false,
                            savedQuery: null,
                            sharedWith: [],
                          };
                          setTabs(prev => [...prev, newTab]);
                          setActiveTabId(newTab.id);
                        }
                      })
                      .catch(error => {
                        setMessage(`❌ Import error: ${error.response?.data?.error || error.message}`);
                      })
                      .finally(() => {
                        setExcelUploading(false);
                        setShowExcelImport(false);
                        e.target.value = '';
                      });
                  }}
                  ref={fileInputRef}
                  style={{
                    marginBottom: '15px',
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${darkMode ? '#2d3748' : '#e2e8f0'}`,
                    borderRadius: '4px',
                    backgroundColor: darkMode ? '#1a202c' : '#f8fafc',
                    color: darkMode ? '#e6eef6' : '#0f172a'
                  }}
                  disabled={excelUploading}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => setShowExcelImport(false)}
                    style={{
                      padding: '6px 12px',
                      background: darkMode ? '#4b5563' : '#e2e8f0',
                      color: darkMode ? '#e6eef6' : '#1f2937',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    disabled={excelUploading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ padding: "8px 12px", display: "flex", gap: 8 }}>
            <select
              value={dbType}
              onChange={(e) => setDbType(e.target.value)}
              style={{ flex: 1, padding: 6, borderRadius: 6 }}
              title="Select database type"
            >
              <option value="sqlite">SQLite</option>
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
            </select>
            <button
              onClick={loadSchema}
              style={{
                padding: 8,
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
              title="Reload schema"
            >
              <FaSync />
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 12px",
              borderTop: "1px solid rgba(255,255,255,0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <FaTable title="Tables" /> <strong>Tables</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tables.length ? (
                tables.map((tbl) => (
                  <div
                    key={tbl}
                    onClick={() =>
                      setActiveContent(`SELECT * FROM ${tbl} LIMIT 100;`)
                    }
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: darkMode ? "#071026" : "#f3f4f6",
                      cursor: "pointer",
                    }}
                    title={`Click to query: ${tbl}`}
                  >
                    {tbl}
                  </div>
                ))
              ) : (
                <div style={{ color: "#9aa3ad" }}>No tables</div>
              )}
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.03)",
              padding: "10px 12px 0 12px",
            }}
          >
            <button
              onClick={() => setHistoryOpen((h) => !h)}
              style={{
                padding: "6px 10px",
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
              title={historyOpen ? "Hide query history" : "Show query history"}
            >
              <FaHistory /> {historyOpen ? "Hide History" : "Show History"}
            </button>
          </div>
          {historyOpen && (
            <ResizableBox
              width={leftWidth}
              height={historyHeight}
              axis="y"
              minConstraints={[leftWidth, 100]}
              maxConstraints={[leftWidth, 400]}
              onResizeStop={(e, data) => setHistoryHeight(data.size.height)}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: darkMode ? "#071021" : "#fff",
                  overflowY: "auto",
                  padding: "10px 12px",
                  borderTop: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  Query History
                </div>
                {history.length ? (
                  history.map((h, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveContent(h.query)}
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        background: darkMode ? "#071026" : "#fff",
                        marginBottom: 8,
                        cursor: "pointer",
                      }}
                      title={`Click to load: ${h.query.slice(0, 50)}...`}
                    >
                      <div style={{ fontSize: 13 }}>
                        {h.query.slice(0, 120)}
                        {h.query.length > 120 ? "..." : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3ad" }}>
                        {new Date(
                          h.created_at || h.timestamp || Date.now()
                        ).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#9aa3ad" }}>No history</div>
                )}
              </div>
            </ResizableBox>
          )}

          {/* Saved Queries Toggle Button */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.03)",
              padding: "10px 12px 0 12px",
            }}
          >
            <button
              onClick={() => setSavedQueriesOpen((s) => !s)}
              style={{
                padding: "6px 10px",
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
              title="Show/Hide Saved Queries"
            >
              <FaBookmark /> {savedQueriesOpen ? "Hide" : "Show"} Saved ({savedQueries.length})
            </button>
          </div>

          {/* Saved Queries Panel */}
          {savedQueriesOpen && (
            <div
              style={{
                width: "100%",
                maxHeight: 300,
                background: darkMode ? "#071021" : "#fff",
                overflowY: "auto",
                padding: "10px 12px",
                borderTop: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <div style={{
                fontWeight: 700,
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span>📌 Saved Queries</span>
                <button
                  onClick={loadSavedQueries}
                  style={{
                    padding: "4px 8px",
                    background: darkMode ? "#1e293b" : "#e5e7eb",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                  title="Refresh saved queries"
                >
                  <FaSync />
                </button>
              </div>

              {savedQueries.length ? (
                savedQueries.map((sq) => (
                  <div
                    key={sq.id}
                    onClick={() => {
                      setActiveContent(sq.query);
                      showToast(`✅ Loaded: ${sq.title}`, "success");
                    }}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: darkMode ? "#071026" : "#f8fafc",
                      marginBottom: 8,
                      cursor: "pointer",
                      border: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = darkMode ? "#0ea5e9" : "#3b82f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = darkMode ? "#1e293b" : "#e5e7eb";
                    }}
                    title={`Click to load: ${sq.query.slice(0, 100)}...`}
                  >
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {sq.is_public ? (
                        <FaUnlock size={10} title="Public query" />
                      ) : (
                        <FaLock size={10} title="Private query" />
                      )}
                      {sq.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3ad", marginBottom: 4 }}>
                      {sq.query.slice(0, 80)}
                      {sq.query.length > 80 ? "..." : ""}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>
                      {new Date(sq.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  color: "#9aa3ad",
                  textAlign: "center",
                  padding: 20,
                  fontSize: 13
                }}>
                  No saved queries yet.<br />
                  <span style={{ fontSize: 11 }}>
                    Use the <FaBookmark style={{ verticalAlign: "middle" }} /> button to save queries
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </ResizableBox>

      {/* Main Editor & Results */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: 10,
            display: "flex",
            gap: 8,
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
            background: darkMode ? "#071021" : "#fff",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setAiOpen((a) => !a)}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Toggle AI Assistant"
          >
            <FaRobot />
          </button>
          <button
            onClick={() => run(getActiveContent())}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Run Query (Ctrl+Enter)"
          >
            <FaPlay />
          </button>
          <button
            onClick={() => setActiveContent("")}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Clear Editor"
          >
            <FaTimes />
          </button>
          <button
            onClick={() => exportCsv()}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Export Results as CSV"
          >
            <FaDownload />
          </button>
          <label
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              display: "inline-flex",
              alignItems: "center",
              userSelect: "none",
            }}
            title="Import CSV File"
          >
            <FaFileImport />
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={importCsv}
              style={{ display: "none" }}
            />
          </label>
          <button
            onClick={() => generateERDiagram()}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Generate ER Diagram"
          >
            <FaProjectDiagram />
          </button>
          <button
            onClick={() => openDashboardTab()}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Open Dashboard"
          >
            <FaChartBar />
          </button>
          <button
            onClick={() => openAnalyticsTab()}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Advanced Analytics"
          >
            <FaBrain />
          </button>
          <button
            onClick={() => openSettingsTab()}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Open Settings"
          >
            <FaCog />
          </button>
          <button
            onClick={() => explainQuery(getActiveContent())}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Explain Query (Execution Plan)"
          >
            <FaLightbulb />
          </button>
          <button
            onClick={() => {
              const q = getActiveContent();
              if (!q.trim()) return showToast("Query is empty", "warning");
              const title = prompt("Enter query title:", `Query ${Date.now()}`);
              if (title) saveQuery(q, title);
            }}
            style={{
              padding: "8px 12px",
              background: darkMode ? "#111827" : "#e5e7eb",
              color: darkMode ? "#e6eef6" : "#111",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Save Current Query"
          >
            <FaBookmark />
          </button>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {/* ---- Toolbar icons with keyboard shortcuts ---- */}
            <div className="toolbar-button-group" style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button
                onClick={() => loadSampleDB()}
                onKeyDown={(e) => e.key === 'l' && e.ctrlKey && loadSampleDB()}
                style={{
                  padding: "8px",
                  background: darkMode ? "#0f172a" : "#f3f4f6",
                  color: darkMode ? "#e6eef6" : "#111",
                  borderRadius: "8px 0 0 8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                  ':hover': {
                    background: darkMode ? "#1e293b" : "#e2e8f0",
                  }
                }}
                title="Load sample database (Ctrl+L)"
                aria-label="Load sample database, keyboard shortcut Control plus L"
              >
                <FaDatabase />
                <span style={{ fontSize: 12, opacity: 0.7 }}>Ctrl+L</span>
              </button>

              <button
                onClick={() => setShowExcelImport(true)}
                onKeyDown={(e) => e.key === 'i' && e.ctrlKey && setShowExcelImport(true)}
                style={{
                  padding: "8px",
                  background: darkMode ? "#0f172a" : "#f3f4f6",
                  color: darkMode ? "#e6eef6" : "#111",
                  borderRadius: "0 8px 8px 0",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                  ':hover': {
                    background: darkMode ? "#1e293b" : "#e2e8f0",
                  }
                }}
                title="Import Excel (Ctrl+I)"
                aria-label="Import Excel file, keyboard shortcut Control plus I"
              >
                <FaFileImport />
                <span style={{ fontSize: 12, opacity: 0.7 }}>Ctrl+I</span>
              </button>
            </div>

            <div style={{ fontSize: 13 }}>{message || "Ready"}</div>
            <div style={{ paddingLeft: 8 }}>
              <strong style={{ color: connected ? "#10B981" : "#EF4444" }}>
                {connected ? "ONLINE" : "OFFLINE"}
              </strong>
            </div>

            {/* User Authentication Status */}
            {isAuthenticated ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div
                  style={{
                    background: darkMode ? "#1e293b" : "#f3f4f6",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FaUser />
                  {currentUser?.username}
                  {userRole === "admin" && (
                    <FaShieldAlt style={{ color: "#f59e0b" }} title="Admin" />
                  )}
                </div>
                <button
                  onClick={logout}
                  style={{
                    padding: "8px 12px",
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  title="Logout"
                >
                  <FaSignOutAlt />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                style={{
                  padding: "8px 12px",
                  background: "#10b981",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                title="Login"
              >
                <FaSignInAlt /> Login
              </button>
            )}

            <button
              onClick={() =>
                setAppSettings((prev) => {
                  const newDarkMode = !prev.darkMode;
                  const updated = { ...prev, darkMode: newDarkMode };
                  localStorage.setItem(
                    "inframinddb_settings",
                    JSON.stringify(updated)
                  );
                  return updated;
                })
              }
              style={{
                padding: "8px 12px",
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 16,
              }}
              title="Toggle Dark/Light Mode"
            >
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            <button
              onClick={() => addTab()}
              style={{
                padding: "8px 12px",
                background: "#0b1220",
                color: "#e6eef6",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 16,
              }}
              title="New Query Tab"
            >
              <FaPlus />
            </button>
          </div>
        </div>

        {/* Tabs row */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "6px 8px",
            background: darkMode ? "#081226" : "#f3f4f6",
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveTabId(t.id)}
              style={{
                padding: "6px 10px",
                background: t.id === activeTabId ? "#0ea5e9" : "#374151",
                color: "#fff",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                minWidth: 100,
                maxWidth: 420,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={t.title}
            >
              <div style={{ flex: 1 }}>{t.title}</div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                title="Close tab"
              >
                <FaTimes />
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ height: `calc(${editorHeightPct}vh)`, minHeight: 160 }}>
          {activeTab?.isER ? (
            <div
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div
                style={{
                  padding: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <strong>ER Diagram (visual)</strong>
              </div>
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <ERDiagramViewer
                  raw={activeTab.content}
                  darkMode={darkMode}
                  filterTables={extractTablesFromQuery(getActiveContent())}
                />
                <div
                  style={{
                    width: 320,
                    borderLeft: "1px solid rgba(255,255,255,0.03)",
                    padding: 8,
                    overflowY: "auto",
                    background: darkMode ? "#071021" : "#fff",
                  }}
                >
                  <div>
                    <strong>Raw ER JSON</strong>
                  </div>
                  <pre
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                    }}
                  >
                    {activeTab.content}
                  </pre>
                </div>
              </div>
            </div>
          ) : activeTab?.isDashboard ? (
            <div
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div
                style={{
                  padding: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <strong>📊 Data Visualization Dashboard</strong>
                <div style={{ float: "right" }}>
                  <button
                    onClick={() => {
                      if (lastResult && lastResult.rows?.length) {
                        setMessage("Dashboard refreshed from last result.");
                      } else {
                        setMessage(
                          "No last result to visualize. Run a query first."
                        );
                      }
                    }}
                    style={{
                      padding: "6px 8px",
                      background: darkMode ? "#111827" : "#e5e7eb",
                      color: darkMode ? "#e6eef6" : "#111",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                    title="Refresh Dashboard"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: 8,
                  padding: 10,
                  overflow: "auto",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: darkMode ? "#071026" : "#fff",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <EnhancedDashboardView result={lastResult} darkMode={darkMode} />
                </div>
              </div>
            </div>
          ) : activeTab?.isAnalytics ? (
            <AdvancedAnalyticsView
              result={lastResult}
              darkMode={darkMode}
              queryPerformance={queryPerformance}
            />
          ) : activeTab?.isSettings ? (
            renderSettingsTab()
          ) : (
            <Editor
              height="100%"
              defaultLanguage={activeTab?.language || "sql"}
              value={activeTab?.content || ""}
              onChange={(val) => updateTabContent(activeTabId, val)}
              theme={darkMode ? "vs-dark" : "light"}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={{
                minimap: { enabled: appSettings.editorMinimap === true },
                fontSize: appSettings.editorFontSize || 14,
                lineNumbers: appSettings.lineNumbers ? "on" : "off",
                wordWrap: appSettings.wordWrap || "on",
                tabSize: appSettings.tabSize || 2,
              }}
            />
          )}
        </div>

        {/* Editor height controls */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 8,
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setEditorHeightPct((p) => Math.min(85, p + 5))}
              style={{
                padding: "6px 10px",
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
              title="Increase editor height"
            >
              ↑
            </button>
            <button
              onClick={() => setEditorHeightPct((p) => Math.max(30, p - 5))}
              style={{
                padding: "6px 10px",
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
              title="Decrease editor height"
            >
              ↓
            </button>
            <button
              onClick={() => setEditorHeightPct(55)}
              style={{
                padding: "6px 10px",
                background: darkMode ? "#111827" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
              title="Reset editor height"
            >
              Reset
            </button>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9aa3ad" }}>
            Editor height: {editorHeightPct}%
          </div>
        </div>

        {/* Results area */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {results && results.length ? (
            results.map((r, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 12,
                  background: darkMode ? "#0b1220" : "#f8fafc",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <div
                  style={{ fontSize: 12, color: "#9aa3ad", marginBottom: 6 }}
                >
                  {r.query}
                </div>
                {r.columns && r.rows ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {r.columns.map((c) => (
                          <th
                            key={c}
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #222",
                              padding: 6,
                            }}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.rows.map((row, ridx) => (
                        <tr key={ridx}>
                          {row.map((cell, cidx) => (
                            <td
                              key={cidx}
                              style={{
                                borderBottom: "1px solid #222",
                                padding: 6,
                              }}
                            >
                              {String(cell ?? "NULL")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: "#9aa3ad" }}>No tabular result</div>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: "#9aa3ad" }}>No results — run a query.</div>
          )}
        </div>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <ResizableBox
          width={rightWidth}
          height={window.innerHeight}
          axis="x"
          minConstraints={[260, window.innerHeight]}
          maxConstraints={[740, window.innerHeight]}
          onResizeStop={(e, data) => setRightWidth(data.size.width)}
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            height: window.innerHeight,
            background: darkMode ? "#071021" : "#fff",
            borderLeft: "1px solid rgba(255,255,255,0.03)",
            zIndex: 33,
            boxShadow: "-2px 0 8px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 700 }}>AI Copilot</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={newChat}
                style={{
                  padding: "6px 8px",
                  background: darkMode ? "#111827" : "#e5e7eb",
                  color: darkMode ? "#e6eef6" : "#111",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                title="New chat"
              >
                🆕 New Chat
              </button>
              <button
                onClick={() => setAiOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: darkMode ? "#e6eef6" : "#111",
                  cursor: "pointer",
                }}
                title="Close AI panel"
              >
                <FaTimes />
              </button>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {aiMessages.length ? (
              aiMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.type === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                  }}
                >
                  <div
                    style={{
                      background:
                        m.type === "user"
                          ? "#2563eb"
                          : darkMode
                            ? "#1e293b"
                            : "#f1f5f9",
                      color:
                        m.type === "user"
                          ? "#fff"
                          : darkMode
                            ? "#e2e8f0"
                            : "#111",
                      padding: "10px 12px",
                      borderRadius: 12,
                      whiteSpace: "pre-wrap",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
                    }}
                  >
                    {m.text && <div>{m.text}</div>}
                    {m.sql && (
                      <>
                        <div style={{ fontWeight: 600, marginTop: 6 }}>
                          💾 SQL:
                        </div>
                        <pre
                          style={{
                            background: darkMode ? "#071026" : "#f3f4f6",
                            color: darkMode ? "#cbd5e1" : "#111",
                            padding: 8,
                            borderRadius: 6,
                            overflowX: "auto",
                          }}
                        >
                          {m.sql}
                        </pre>
                        {m.explanation && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 13,
                              color: darkMode ? "#cbd5e1" : "#374151",
                            }}
                          >
                            {m.explanation}
                          </div>
                        )}
                        {m.hasAccept && (
                          <div style={{ textAlign: "right", marginTop: 8 }}>
                            <button
                              onClick={() => acceptSqlToEditor(m.sql)}
                              style={{
                                background: "#10B981",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 10px",
                                cursor: "pointer",
                              }}
                              title="Accept SQL to editor"
                            >
                              Accept SQL Only
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#9aa3ad", textAlign: "center" }}>
                Ask the AI for SQL help
              </div>
            )}
            {aiLoading && <div style={{ color: "#60a5fa" }}>Thinking...</div>}
            <div ref={chatEndRef} />
          </div>
          <div
            style={{
              padding: 12,
              borderTop: "1px solid rgba(255,255,255,0.03)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") askAI();
              }}
              placeholder="Ask AI in natural language..."
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #374151",
                background: darkMode ? "#0f172a" : "#fff",
                color: darkMode ? "#fff" : "#111",
              }}
              title="Type your AI query"
            />
            <button
              onClick={askAI}
              disabled={aiLoading}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: aiLoading ? "not-allowed" : "pointer",
              }}
              title="Send AI query"
            >
              {aiLoading ? <FaSpinner className="spin" /> : "Send"}
            </button>
          </div>
          <style>{`.spin{animation:spin 1s linear infinite;}@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`}</style>
        </ResizableBox>
      )}
    </div>
  );
}


// ER Diagram Viewer Component
function ERDiagramViewer({ raw, darkMode, filterTables }) {
  let parsed = null;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    parsed = null;
  }
  if (!parsed || !parsed.tables) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: darkMode ? "#9aa3ad" : "#374151",
        }}
      >
        No ER structure to render — run Generate ER Diagram.
      </div>
    );
  }
  const allTableNames = Object.keys(parsed.tables);

  let tablesToRender = allTableNames;
  if (filterTables && filterTables.length) {
    const filteredLower = filterTables.map((t) => t.toLowerCase());
    const filteredTables = allTableNames.filter((t) =>
      filteredLower.includes(t.toLowerCase())
    );
    if (filteredTables.length > 0) tablesToRender = filteredTables;
  }

  if (tablesToRender.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          color: darkMode ? "#9aa3ad" : "#374151",
          whiteSpace: "pre-wrap",
        }}
      >
        No tables from the current query found in ER diagram.
      </div>
    );
  }

  const nodes = tablesToRender.map((tbl, idx) => {
    const cols = parsed.tables[tbl].columns || [];
    const x = (idx % 3) * 260;
    const y = Math.floor(idx / 3) * 140;
    return {
      id: tbl,
      data: { label: `${tbl}\n${cols.join("\n")}` },
      position: { x, y },
      style: {
        background: darkMode ? "#0f1724" : "#fff",
        color: darkMode ? "#e6eef6" : "#111",
        border: "1px solid rgba(96,165,250,0.15)",
        borderRadius: 8,
        padding: 8,
        whiteSpace: "pre-line",
      },
    };
  });

  const edges = [];
  tablesToRender.forEach((tbl) => {
    const rels = parsed.tables[tbl].relations || [];
    rels.forEach((r, i) => {
      const tgt = r.target || r.to || r.table;
      if (tgt && tablesToRender.includes(tgt)) {
        edges.push({
          id: `${tbl}-${tgt}-${i}`,
          source: tbl,
          target: tgt,
          animated: true,
          style: { stroke: "#60a5fa" },
        });
      }
    });
  });

  return (
    <div style={{ flex: 1, width: "100%", height: "100%" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <MiniMap />
        <Controls />
        <Background gap={12} color={darkMode ? "#0b1220" : "#f3f4f6"} />
      </ReactFlow>
    </div>
  );
}

// ===== ENHANCED DASHBOARD VIEW COMPONENT =====
function EnhancedDashboardView({ result, darkMode }) {
  const chartRef = useRef(null);

  // Chart configuration state
  const [chartType, setChartType] = useState("bar");
  const [xAxisColumn, setXAxisColumn] = useState(null);
  const [yAxisColumn, setYAxisColumn] = useState(null);

  if (!result || !result.columns || !result.rows) {
    return (
      <div style={{ color: "#9aa3ad", padding: 20, textAlign: "center" }}>
        <FaChartBar size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>No Data to Visualize</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>
          Run a SELECT query to see visualizations
        </div>
      </div>
    );
  }

  const cols = result.columns;
  const rows = result.rows;

  // Auto-detect numeric columns
  const numericColumns = cols.filter((col, idx) => {
    const sample = rows[0]?.[idx];
    return typeof sample === "number" || !isNaN(Number(sample));
  });

  const categoricalColumns = cols.filter(
    (col) => !numericColumns.includes(col)
  );

  // Initialize column selections
  useEffect(() => {
    if (!xAxisColumn && cols.length > 0) {
      setXAxisColumn(categoricalColumns[0] || cols[0]);
    }
    if (!yAxisColumn && numericColumns.length > 0) {
      setYAxisColumn(numericColumns[0]);
    }
  }, [cols, rows]);

  const xIndex = cols.indexOf(xAxisColumn || cols[0]);
  const yIndex = cols.indexOf(yAxisColumn || (numericColumns[0] || cols[1] || cols[0]));

  // Prepare chart data
  const data = rows.map((r, i) => {
    const xVal = String(r[xIndex] ?? `row-${i}`);
    const yRaw = r[yIndex];
    const yVal =
      typeof yRaw === "number" ? yRaw : isNaN(Number(yRaw)) ? 0 : Number(yRaw);
    return {
      name: xVal,
      value: yVal,
      [xAxisColumn || "category"]: xVal,
      [yAxisColumn || "value"]: yVal,
    };
  });

  const chartData = data.length > 100 ? data.slice(0, 100) : data;

  // Calculate statistics
  const values = chartData.map((d) => d.value);
  const stats = {
    total: values.reduce((a, b) => a + b, 0),
    average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };

  // Export chart as image
  const exportChart = () => {
    if (!chartRef.current) return;

    try {
      const svg = chartRef.current.querySelector("svg");
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      canvas.width = svg.width.baseVal.value;
      canvas.height = svg.height.baseVal.value;

      img.onload = () => {
        ctx.fillStyle = darkMode ? "#071026" : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `chart_${chartType}_${Date.now()}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };

      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export chart. Try a different browser.");
    }
  };

  // Render selected chart type
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 60 },
    };

    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e5e7eb"} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              stroke={darkMode ? "#94a3ad" : "#6b7280"}
            />
            <YAxis stroke={darkMode ? "#94a3ad" : "#6b7280"} />
            <Tooltip
              contentStyle={{
                background: darkMode ? "#1e293b" : "#fff",
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                borderRadius: 8,
              }}
            />
            <Legend />
            <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[8, 8, 0, 0]} />
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e5e7eb"} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              stroke={darkMode ? "#94a3ad" : "#6b7280"}
            />
            <YAxis stroke={darkMode ? "#94a3ad" : "#6b7280"} />
            <Tooltip
              contentStyle={{
                background: darkMode ? "#1e293b" : "#fff",
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                borderRadius: 8,
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS[1]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.8} />
                <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e5e7eb"} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              stroke={darkMode ? "#94a3ad" : "#6b7280"}
            />
            <YAxis stroke={darkMode ? "#94a3ad" : "#6b7280"} />
            <Tooltip
              contentStyle={{
                background: darkMode ? "#1e293b" : "#fff",
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                borderRadius: 8,
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS[2]}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData.slice(0, 10)}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={(entry) => entry.name}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.slice(0, 10).map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: darkMode ? "#1e293b" : "#fff",
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                borderRadius: 8,
              }}
            />
            <Legend />
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e5e7eb"} />
            <XAxis
              dataKey="name"
              stroke={darkMode ? "#94a3ad" : "#6b7280"}
            />
            <YAxis stroke={darkMode ? "#94a3ad" : "#6b7280"} />
            <Tooltip
              contentStyle={{
                background: darkMode ? "#1e293b" : "#fff",
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                borderRadius: 8,
              }}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Legend />
            <Scatter
              name={yAxisColumn || "value"}
              data={chartData}
              fill={CHART_COLORS[4]}
            />
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Statistics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard
          title="Total"
          value={stats.total.toLocaleString()}
          icon={<FaChartBar />}
          color="#8884d8"
          darkMode={darkMode}
        />
        <StatCard
          title="Average"
          value={stats.average.toFixed(2)}
          icon={<FaChartLine />}
          color="#82ca9d"
          darkMode={darkMode}
        />
        <StatCard
          title="Maximum"
          value={stats.max.toLocaleString()}
          icon={<FaChartArea />}
          color="#ffc658"
          darkMode={darkMode}
        />
        <StatCard
          title="Count"
          value={stats.count}
          icon={<FaChartPie />}
          color="#ff7c7c"
          darkMode={darkMode}
        />
      </div>

      {/* Chart Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: 12,
          background: darkMode ? "#0f172a" : "#f8fafc",
          borderRadius: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Chart Type:</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
              background: darkMode ? "#1e293b" : "#fff",
              color: darkMode ? "#e6eef6" : "#111",
              fontSize: 13,
            }}
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="area">Area Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="scatter">Scatter Plot</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>X-Axis:</label>
          <select
            value={xAxisColumn || ""}
            onChange={(e) => setXAxisColumn(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
              background: darkMode ? "#1e293b" : "#fff",
              color: darkMode ? "#e6eef6" : "#111",
              fontSize: 13,
            }}
          >
            {cols.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Y-Axis:</label>
          <select
            value={yAxisColumn || ""}
            onChange={(e) => setYAxisColumn(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
              background: darkMode ? "#1e293b" : "#fff",
              color: darkMode ? "#e6eef6" : "#111",
              fontSize: 13,
            }}
          >
            {numericColumns.length > 0 ? (
              numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))
            ) : (
              cols.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          onClick={exportChart}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            background: "#0ea5e9",
            color: "#fff",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          title="Export chart as PNG"
        >
          <FaCamera /> Export
        </button>
      </div>

      {/* Chart Display */}
      <div
        ref={chartRef}
        style={{
          flex: 1,
          background: darkMode ? "#0f172a" : "#fff",
          borderRadius: 8,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Data Table Preview */}
      <div
        style={{
          background: darkMode ? "#0f172a" : "#fff",
          borderRadius: 8,
          padding: 12,
          maxHeight: 300,
          overflow: "auto",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
          📋 Data Preview ({rows.length} rows)
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                    padding: 8,
                    fontWeight: 600,
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr
                key={i}
                style={{
                  background:
                    i % 2 === 0
                      ? darkMode
                        ? "#071026"
                        : "#f8fafc"
                      : "transparent",
                }}
              >
                {r.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`,
                      padding: 8,
                    }}
                  >
                    {String(cell ?? "NULL")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== ADVANCED ANALYTICS VIEW COMPONENT =====
function AdvancedAnalyticsView({ result, darkMode, queryPerformance }) {
  const [analysisType, setAnalysisType] = useState("overview");
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filterValue, setFilterValue] = useState("");
  const [filteredData, setFilteredData] = useState(null);

  if (!result || !result.columns || !result.rows) {
    return (
      <div style={{
        height: "100%",
        background: darkMode ? "#071021" : "#fff",
        color: darkMode ? "#e6eef6" : "#111",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <FaBrain size={64} style={{ opacity: 0.3, marginBottom: 20 }} />
        <h2>Advanced Analytics Dashboard</h2>
        <p style={{ color: "#9aa3ad", marginTop: 12 }}>
          Run a SELECT query to access professional data analysis tools
        </p>
        <div style={{ marginTop: 32, textAlign: "left", maxWidth: 600 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Available Features:</h3>
          <ul style={{ lineHeight: 2 }}>
            <li>📊 Statistical Analysis (mean, median, std dev, quartiles)</li>
            <li>🔍 Data Quality Assessment (missing values, duplicates, outliers)</li>
            <li>📈 Correlation Analysis (relationships between variables)</li>
            <li>🎯 Distribution Analysis (histograms, frequency tables)</li>
            <li>⚡ Query Performance Tracking</li>
            <li>🔬 Advanced Filtering & Drill-down</li>
          </ul>
        </div>
      </div>
    );
  }

  const cols = result.columns;
  const rows = result.rows;

  // Data processing
  const numericColumns = cols.filter((col, idx) => {
    const sample = rows[0]?.[idx];
    return typeof sample === "number" || !isNaN(Number(sample));
  });

  // Calculate advanced statistics
  const calculateStats = (columnIndex) => {
    const values = rows.map(r => {
      const val = r[columnIndex];
      return typeof val === "number" ? val : parseFloat(val);
    }).filter(v => !isNaN(v));

    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const q1Index = Math.floor(sorted.length * 0.25);
    const q2Index = Math.floor(sorted.length * 0.50);
    const q3Index = Math.floor(sorted.length * 0.75);

    return {
      count: values.length,
      sum,
      mean,
      median: sorted[q2Index],
      mode: findMode(values),
      stdDev,
      variance,
      min: Math.min(...values),
      max: Math.max(...values),
      q1: sorted[q1Index],
      q3: sorted[q3Index],
      range: Math.max(...values) - Math.min(...values),
    };
  };

  const findMode = (arr) => {
    const freq = {};
    let maxFreq = 0;
    let mode = arr[0];

    arr.forEach(val => {
      freq[val] = (freq[val] || 0) + 1;
      if (freq[val] > maxFreq) {
        maxFreq = freq[val];
        mode = val;
      }
    });

    return mode;
  };

  // Data quality assessment
  const assessDataQuality = () => {
    const quality = {};

    cols.forEach((col, idx) => {
      const values = rows.map(r => r[idx]);
      const nullCount = values.filter(v => v === null || v === undefined || v === "").length;
      const uniqueCount = new Set(values.filter(v => v !== null && v !== undefined)).size;

      quality[col] = {
        totalRows: rows.length,
        nullCount,
        nullPercentage: ((nullCount / rows.length) * 100).toFixed(2),
        uniqueCount,
        uniquePercentage: ((uniqueCount / rows.length) * 100).toFixed(2),
        duplicateCount: rows.length - uniqueCount,
      };
    });

    return quality;
  };

  // Correlation calculation
  const calculateCorrelation = (col1Idx, col2Idx) => {
    const data1 = rows.map(r => parseFloat(r[col1Idx])).filter(v => !isNaN(v));
    const data2 = rows.map(r => parseFloat(r[col2Idx])).filter(v => !isNaN(v));

    if (data1.length !== data2.length || data1.length === 0) return null;

    const mean1 = data1.reduce((a, b) => a + b, 0) / data1.length;
    const mean2 = data2.reduce((a, b) => a + b, 0) / data2.length;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < data1.length; i++) {
      const diff1 = data1[i] - mean1;
      const diff2 = data2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    return numerator / Math.sqrt(denom1 * denom2);
  };

  const renderContent = () => {
    switch (analysisType) {
      case "overview":
        return renderOverview();
      case "statistics":
        return renderStatistics();
      case "quality":
        return renderDataQuality();
      case "correlation":
        return renderCorrelation();
      case "performance":
        return renderPerformance();
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => {
    const quality = assessDataQuality();
    const totalCells = rows.length * cols.length;
    const totalNulls = Object.values(quality).reduce((sum, q) => sum + q.nullCount, 0);

    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Data Overview</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <MetricCard
            title="Total Rows"
            value={rows.length.toLocaleString()}
            icon="📊"
            darkMode={darkMode}
          />
          <MetricCard
            title="Total Columns"
            value={cols.length}
            icon="📋"
            darkMode={darkMode}
          />
          <MetricCard
            title="Numeric Columns"
            value={numericColumns.length}
            icon="🔢"
            darkMode={darkMode}
          />
          <MetricCard
            title="Data Completeness"
            value={`${(((totalCells - totalNulls) / totalCells) * 100).toFixed(1)}%`}
            icon="✅"
            darkMode={darkMode}
          />
        </div>

        <h3 style={{ marginBottom: 16 }}>Column Summary</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: darkMode ? "#1e293b" : "#f3f4f6" }}>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Column</th>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Type</th>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Unique</th>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Nulls</th>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Completeness</th>
              </tr>
            </thead>
            <tbody>
              {cols.map((col, idx) => {
                const isNumeric = numericColumns.includes(col);
                const q = quality[col];
                return (
                  <tr key={col}>
                    <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>{col}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>
                      {isNumeric ? "Numeric" : "Text"}
                    </td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>
                      {q.uniqueCount} ({q.uniquePercentage}%)
                    </td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>
                      {q.nullCount} ({q.nullPercentage}%)
                    </td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>
                      <div style={{
                        width: "100%",
                        height: 20,
                        background: darkMode ? "#374151" : "#e5e7eb",
                        borderRadius: 4,
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${100 - parseFloat(q.nullPercentage)}%`,
                          height: "100%",
                          background: "#10b981",
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStatistics = () => {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Statistical Analysis</h2>

        {numericColumns.length === 0 ? (
          <div style={{ color: "#9aa3ad", padding: 40, textAlign: "center" }}>
            No numeric columns found for statistical analysis
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: darkMode ? "#1e293b" : "#f3f4f6" }}>
                  <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Metric</th>
                  {numericColumns.map(col => (
                    <th key={col} style={{ padding: 10, textAlign: "right", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["count", "sum", "mean", "median", "mode", "stdDev", "variance", "min", "max", "q1", "q3", "range"].map(metric => (
                  <tr key={metric}>
                    <td style={{
                      padding: 10,
                      fontWeight: 600,
                      borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`
                    }}>
                      {metric.toUpperCase()}
                    </td>
                    {numericColumns.map(col => {
                      const colIdx = cols.indexOf(col);
                      const stats = calculateStats(colIdx);
                      return (
                        <td key={col} style={{
                          padding: 10,
                          textAlign: "right",
                          borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`
                        }}>
                          {stats ? (typeof stats[metric] === "number" ? stats[metric].toFixed(2) : stats[metric]) : "N/A"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderDataQuality = () => {
    const quality = assessDataQuality();

    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Data Quality Assessment</h2>

        <div style={{ display: "grid", gap: 16 }}>
          {cols.map((col, idx) => {
            const q = quality[col];
            const healthScore = 100 - parseFloat(q.nullPercentage);

            return (
              <div
                key={col}
                style={{
                  background: darkMode ? "#0f172a" : "#f8fafc",
                  padding: 16,
                  borderRadius: 8,
                  border: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16 }}>{col}</h3>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: healthScore > 95 ? "#10b981" : healthScore > 80 ? "#f59e0b" : "#ef4444",
                    color: "#fff"
                  }}>
                    {healthScore.toFixed(1)}% Health
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#9aa3ad" }}>Missing Values</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {q.nullCount} ({q.nullPercentage}%)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#9aa3ad" }}>Unique Values</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {q.uniqueCount} ({q.uniquePercentage}%)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#9aa3ad" }}>Duplicates</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {q.duplicateCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCorrelation = () => {
    if (numericColumns.length < 2) {
      return (
        <div style={{ padding: 20, textAlign: "center", color: "#9aa3ad" }}>
          Need at least 2 numeric columns for correlation analysis
        </div>
      );
    }

    const correlationMatrix = [];
    numericColumns.forEach((col1, i) => {
      const row = [];
      numericColumns.forEach((col2, j) => {
        const col1Idx = cols.indexOf(col1);
        const col2Idx = cols.indexOf(col2);
        const corr = calculateCorrelation(col1Idx, col2Idx);
        row.push(corr !== null ? corr : 0);
      });
      correlationMatrix.push(row);
    });

    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Correlation Matrix</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}></th>
                {numericColumns.map(col => (
                  <th key={col} style={{
                    padding: 10,
                    textAlign: "center",
                    fontSize: 12,
                    borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numericColumns.map((col1, i) => (
                <tr key={col1}>
                  <td style={{
                    padding: 10,
                    fontWeight: 600,
                    fontSize: 12,
                    borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`
                  }}>
                    {col1}
                  </td>
                  {correlationMatrix[i].map((corr, j) => {
                    const absCorr = Math.abs(corr);
                    let bgColor = darkMode ? "#1e293b" : "#f3f4f6";

                    if (absCorr > 0.7) bgColor = "#ef4444";
                    else if (absCorr > 0.5) bgColor = "#f59e0b";
                    else if (absCorr > 0.3) bgColor = "#10b981";

                    return (
                      <td
                        key={j}
                        style={{
                          padding: 10,
                          textAlign: "center",
                          background: bgColor,
                          color: absCorr > 0.3 ? "#fff" : "inherit",
                          fontWeight: absCorr > 0.5 ? 600 : 400,
                          borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`
                        }}
                      >
                        {corr.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: darkMode ? "#0f172a" : "#f8fafc", borderRadius: 8 }}>
          <h4 style={{ marginBottom: 8 }}>Interpretation Guide:</h4>
          <ul style={{ lineHeight: 2, fontSize: 14 }}>
            <li><span style={{ padding: "2px 8px", background: "#ef4444", color: "#fff", borderRadius: 4 }}>0.7+</span> Strong correlation</li>
            <li><span style={{ padding: "2px 8px", background: "#f59e0b", color: "#fff", borderRadius: 4 }}>0.5-0.7</span> Moderate correlation</li>
            <li><span style={{ padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 4 }}>0.3-0.5</span> Weak correlation</li>
            <li><span style={{ padding: "2px 8px", background: darkMode ? "#1e293b" : "#f3f4f6", borderRadius: 4 }}>&lt;0.3</span> Very weak/no correlation</li>
          </ul>
        </div>
      </div>
    );
  };

  const renderPerformance = () => {
    if (!queryPerformance || queryPerformance.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: "center", color: "#9aa3ad" }}>
          <FaClock size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div>No query performance data available yet</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Run some queries to see performance metrics</div>
        </div>
      );
    }

    const avgDuration = queryPerformance.reduce((sum, q) => sum + q.duration, 0) / queryPerformance.length;
    const slowestQuery = queryPerformance.reduce((prev, curr) => prev.duration > curr.duration ? prev : curr);
    const fastestQuery = queryPerformance.reduce((prev, curr) => prev.duration < curr.duration ? prev : curr);

    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Query Performance Analytics</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <MetricCard
            title="Total Queries"
            value={queryPerformance.length}
            icon="📊"
            darkMode={darkMode}
          />
          <MetricCard
            title="Avg Duration"
            value={`${avgDuration.toFixed(2)}ms`}
            icon="⚡"
            darkMode={darkMode}
          />
          <MetricCard
            title="Fastest"
            value={`${fastestQuery.duration.toFixed(2)}ms`}
            icon="🚀"
            darkMode={darkMode}
          />
          <MetricCard
            title="Slowest"
            value={`${slowestQuery.duration.toFixed(2)}ms`}
            icon="🐌"
            darkMode={darkMode}
          />
        </div>

        <h3 style={{ marginBottom: 16 }}>Recent Query History</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: darkMode ? "#1e293b" : "#f3f4f6" }}>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Query</th>
                <th style={{ padding: 10, textAlign: "right", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Duration (ms)</th>
                <th style={{ padding: 10, textAlign: "right", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Rows</th>
                <th style={{ padding: 10, textAlign: "left", borderBottom: `1px solid ${darkMode ? "#374151" : "#d1d5db"}` }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {queryPerformance.slice(0, 20).map((q, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`, maxWidth: 400 }}>
                    <code style={{ fontSize: 12 }}>{q.query}</code>
                  </td>
                  <td style={{
                    padding: 10,
                    textAlign: "right",
                    borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`,
                    color: q.duration > avgDuration * 1.5 ? "#ef4444" : q.duration < avgDuration * 0.5 ? "#10b981" : "inherit"
                  }}>
                    {q.duration.toFixed(2)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>
                    {q.rowCount}
                  </td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}` }}>
                    {new Date(q.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Performance Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={queryPerformance.slice(0, 50).reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e5e7eb"} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => new Date(val).toLocaleTimeString()}
                stroke={darkMode ? "#94a3ad" : "#6b7280"}
              />
              <YAxis stroke={darkMode ? "#94a3ad" : "#6b7280"} />
              <Tooltip
                contentStyle={{
                  background: darkMode ? "#1e293b" : "#fff",
                  border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                  borderRadius: 8,
                }}
                labelFormatter={(val) => new Date(val).toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="duration"
                stroke="#8884d8"
                name="Duration (ms)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="rowCount"
                stroke="#82ca9d"
                name="Row Count"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      height: "100%",
      background: darkMode ? "#071021" : "#fff",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Analysis Type Selector */}
      <div style={{
        padding: 16,
        borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`,
        display: "flex",
        gap: 8,
        overflowX: "auto"
      }}>
        {[
          { id: "overview", label: "📊 Overview", icon: <FaChartBar /> },
          { id: "statistics", label: "📈 Statistics", icon: <FaCalculator /> },
          { id: "quality", label: "✅ Data Quality", icon: <FaSearch /> },
          { id: "correlation", label: "🔗 Correlation", icon: <FaChartArea /> },
          { id: "performance", label: "⚡ Performance", icon: <FaClock /> },
        ].map(type => (
          <button
            key={type.id}
            onClick={() => setAnalysisType(type.id)}
            style={{
              padding: "8px 16px",
              background: analysisType === type.id ? "#0ea5e9" : (darkMode ? "#1e293b" : "#f3f4f6"),
              color: analysisType === type.id ? "#fff" : (darkMode ? "#e6eef6" : "#111"),
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {renderContent()}
      </div>
    </div>
  );
}

// Statistics Card Component
function StatCard({ title, value, icon, color, darkMode }) {
  return (
    <div
      style={{
        background: darkMode ? "#0f172a" : "#fff",
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: darkMode ? "#94a3ad" : "#6b7280",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ color }}>{icon}</span>
        {title}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: darkMode ? "#e6eef6" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon, darkMode }) {
  return (
    <div
      style={{
        background: darkMode ? "#0f172a" : "#fff",
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${darkMode ? "#1e293b" : "#e5e7eb"}`,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: "#9aa3ad", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// Authentication Modal Component
function AuthModal({ darkMode, onLogin, onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(username, password);
    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: darkMode ? "#1e293b" : "#fff",
          padding: 32,
          borderRadius: 12,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ marginBottom: 24, textAlign: "center" }}>
          <FaUser style={{ marginRight: 8 }} />
          Login to InframindDB
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                background: darkMode ? "#0f172a" : "#fff",
                color: darkMode ? "#e6eef6" : "#111",
                fontSize: 14,
              }}
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${darkMode ? "#374151" : "#d1d5db"}`,
                background: darkMode ? "#0f172a" : "#fff",
                color: darkMode ? "#e6eef6" : "#111",
                fontSize: 14,
              }}
              required
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: "#10b981",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 16px",
                background: darkMode ? "#374151" : "#e5e7eb",
                color: darkMode ? "#e6eef6" : "#111",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Index Recommendations Panel
function IndexRecommendationsPanel({ recommendations, darkMode, onClose, onApply }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: darkMode ? "#1e293b" : "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        maxWidth: 500,
        zIndex: 9998,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <FaLightbulb style={{ color: "#f59e0b" }} />
          Index Recommendations
        </h3>
        <FaTimes onClick={onClose} style={{ cursor: "pointer" }} />
      </div>

      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            style={{
              background: darkMode ? "#0f172a" : "#f3f4f6",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {rec.table} - {rec.column}
            </div>
            <div style={{ fontSize: 13, color: "#9aa3ad", marginBottom: 8 }}>
              {rec.reason}
            </div>
            <code
              style={{
                display: "block",
                background: darkMode ? "#071026" : "#fff",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {rec.sql}
            </code>
            <button
              onClick={() => onApply(rec.sql)}
              style={{
                padding: "6px 12px",
                background: "#10b981",
                color: "#fff",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Apply to Editor
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Query Explanation Panel
function QueryExplanationPanel({ explanation, darkMode, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        background: darkMode ? "#1e293b" : "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        maxWidth: 600,
        zIndex: 9998,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <FaFileCode style={{ color: "#3b82f6" }} />
          Query Execution Plan
        </h3>
        <FaTimes onClick={onClose} style={{ cursor: "pointer" }} />
      </div>

      <pre
        style={{
          background: darkMode ? "#0f172a" : "#f3f4f6",
          padding: 16,
          borderRadius: 8,
          overflowX: "auto",
          fontSize: 12,
          maxHeight: 400,
        }}
      >
        {JSON.stringify(explanation, null, 2)}
      </pre>
    </div>
  );
}

// Add animation styles
const styleElement = document.createElement("style");
styleElement.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(styleElement);