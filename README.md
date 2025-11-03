# InfraDB - Full Stack Database Management System

A production-ready full-stack Database Management System with AI-powered SQL assistance using Cohere AI.

**🌐 Live Demo:** [https://infradb-app.vercel.app/](https://infradb-app.vercel.app/)  
**🔗 Backend API:** [https://infradb-backend.onrender.com](https://infradb-backend.onrender.com)  
**📦 GitHub:** [https://github.com/partha-hue/infradb](https://github.com/partha-hue/infradb)

---

## 🚀 Project Structure


---

## ✨ Features

### Backend
- 🔐 **Django REST Framework API** - RESTful endpoints for database operations
- 🤖 **AI-powered SQL generation** - Natural language to SQL using Cohere AI
- 👤 **User authentication** - JWT-based auth with Django REST Framework
- 📝 **Query history tracking** - Store and retrieve past queries
- 🗄️ **Multi-database support** - PostgreSQL (production) / SQLite (development)
- 🔒 **Production-ready security** - CORS, CSRF, XSS protection
- 📊 **Database schema visualization** - Auto-generate ER diagrams
- 📥 **CSV/Excel import** - Import data from files

### Frontend
- 💻 **Modern React interface** - Built with Vite for fast development
- 🎨 **Interactive database UI** - Manage databases visually
- ⚡ **Real-time query execution** - Run SQL with instant results
- 🧠 **AI-assisted SQL** - Generate queries from natural language
- 📱 **Responsive design** - Works on desktop and mobile

---

## 🛠️ Tech Stack

**Backend:**
- Django 5.2
- Django REST Framework 3.15
- PostgreSQL / SQLite
- Cohere AI API
- Gunicorn + WhiteNoise
- dj-database-url

**Frontend:**
- React 18
- Vite
- Axios
- Modern ES6+ JavaScript

**Deployment:**
- Backend: Render
- Frontend: Vercel
- Database: PostgreSQL (Render)

---

## 📋 Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (for production)
- Cohere API Key (get free at [cohere.com](https://cohere.com))

---

### Backend Setup

1. **Navigate to backend:**

2. **Create virtual environment:**

3. **Install dependencies:**

4. **Create `.env` file in `backend/` directory:**

Generate SECRET_KEY:

5. **Run migrations:**

6. **Create superuser:**

7. **Run backend server:**

Backend API: `http://127.0.0.1:8000/`  
Admin Panel: `http://127.0.0.1:8000/admin/`

---

### Frontend Setup

1. **Navigate to frontend:**

2. **Install dependencies:**

3. **Create `.env` file in `frontend/` directory:**

4. **Run frontend:**

Frontend UI: `http://localhost:5173/`

---

## 🚢 Production Deployment

### Backend (Render)

**Environment Variables:**

**Build Command:**

**Start Command:**

---

### Frontend (Vercel)

**Environment Variables:**

**Build Settings:**
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

---

## 🔐 Security Features

- ✅ Environment-based configuration
- ✅ HTTPS enforcement in production
- ✅ Secure session & cookie settings
- ✅ CSRF & XSS protection
- ✅ SQL injection prevention via ORM
- ✅ Secrets stored in environment variables
- ✅ CORS properly configured
- ✅ Production/Development settings separation

---

## 🤖 AI Integration

Powered by **Cohere AI** for:
- 🧠 Intelligent SQL query generation
- 💬 Natural language to SQL conversion
- 📊 Query optimization suggestions
- 🔍 Database schema understanding

*Note: AI features require `COHERE_API_KEY` in environment variables.*

---

## 📂 Project Highlights

- ✅ Separation of development and production settings
- ✅ Database query history tracking
- ✅ AI-powered query suggestions
- ✅ User-friendly database management interface
- ✅ Scalable architecture (production-ready)
- ✅ RESTful API design
- ✅ Modern React frontend with Vite
- ✅ Complete authentication system
- ✅ CSV/Excel data import
- ✅ ER diagram generation

---

## 📝 API Endpoints

**Authentication:**
- `POST /api/auth/login/` - User login
- `POST /api/auth/register/` - User registration

**Database Operations:**
- `GET /api/schema/` - Get database schema
- `POST /api/connect/` - Connect to database
- `POST /api/disconnect/` - Disconnect database
- `GET /api/databases/list/` - List databases
- `POST /api/databases/create/` - Create database

**Query Operations:**
- `POST /api/queries/run/` - Execute SQL query
- `GET /api/queries/history/` - Get query history
- `POST /api/queries/save/` - Save query
- `GET /api/queries/saved/` - Get saved queries
- `POST /api/queries/explain/` - Explain query plan

**AI Features:**
- `POST /api/ai/query_suggest/` - AI-powered query generation

---

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 👨‍💻 Author

**Partha Chakraborty**  
Full Stack Developer | Database Systems Specialist  
AI Integration & Production Architecture

**Email:** parthachakraborty383@gmail.com  
**GitHub:** [@partha-hue](https://github.com/partha-hue)  
**LinkedIn:** [Your LinkedIn Profile]

---

## 🔗 Links

- **Live Demo:** [https://infradb-app.vercel.app/](https://infradb-app.vercel.app/)
- **Backend API:** [https://infradb-backend.onrender.com](https://infradb-backend.onrender.com)
- **GitHub Repository:** [https://github.com/partha-hue/infradb](https://github.com/partha-hue/infradb)

---

## 🎯 Use Cases

- Database administration and management
- SQL query development and testing
- Data analysis and exploration
- Learning SQL with AI assistance
- Database schema visualization
- Team collaboration on database projects

---

## 🙏 Acknowledgments

- [Django REST Framework](https://www.django-rest-framework.org/)
- [Cohere AI](https://cohere.com/)
- [Render](https://render.com/)
- [Vercel](https://vercel.com/)

---

⭐ **Star this repository if you find it useful!**

Made with ❤️ by Partha Chakraborty
cd C:\infradb
# Backup old README first
Copy-Item README.md README.md.backup

# Create new README
code README.md
