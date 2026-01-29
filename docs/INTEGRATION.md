# Integration Checklist

Use these steps to manually verify frontend ↔ backend integration.

1. Start the backend server (Django):
   - Activate environment and run `python manage.py runserver`.
   - Confirm `http://127.0.0.1:8000/ping` returns `{ "status": "ok" }`.

2. Start the frontend (Vite/Electron dev):
   - From `frontend/` run `npm install` (if needed) and `npm run dev` / `npm start`.

3. Onboarding / Quick test:
   - In the app toolbar click **Sample DB**. It should create and connect to `sample_db.sqlite3`.
   - Confirm the connection indicator shows "Connected".
   - Open schema sidebar and confirm tables appear (`products`, `customers`, `orders`).

4. Run a query:
   - Create or use an existing tab with `SELECT * FROM products;` and hit **Run** (or Ctrl+Enter).
   - Results should appear in the results panel and history should update.

5. Explain a query:
   - With a query selected, click **Explain**. Execution plan or console output should appear.

6. Save query:
   - Click **Save**, enter a title when prompted. Confirm success message.

7. Error handling:
   - Disconnect or delete the `current` connection server-side and attempt to run a query.
   - The app should show an error and prompt you to connect.

8. Uploads (CSV/Excel):
   - Currently backend endpoints exist (`/import_csv`, `/import_excel`); frontend file upload flow will be added next.

9. Further tests:
   - Test MySQL/PostgreSQL connections using real credentials (use caution with production data).

If anything fails, capture frontend console logs and backend logs, then open an issue.
