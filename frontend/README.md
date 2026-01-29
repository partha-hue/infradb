# InfraDB Frontend (Dev)

This frontend is a minimal VS Code–style scaffold using Vite + React and Monaco Editor.

## Quick start (dev)

1. Fix any locked `electron` artifacts (Windows):
   - Reboot OR use Sysinternals `handle.exe`/Process Explorer to find/close handles for `node_modules\electron\dist\resources\default_app.asar`.
2. Install deps and run dev server:

```powershell
cd frontend
npm install
npm run dev
```

If `npm install` fails with EBUSY on Windows for Electron resources, try:
- Reboot the machine; or
- Run Sysinternals Handle as Administrator to find the locking process and close it.

## What's implemented
- Sidebar, Topbar, Editor area (Monaco), File Explorer, Query History, Connection modal
- API helpers for ping, run query, saved queries, schema
- Desktop integration: Electron main process, IPC handlers for Open/Save, and menu template added so the app can run as a desktop IDE

