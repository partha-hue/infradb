# InfraDB - Full Stack Database Management System

A production-ready full-stack Database Management System with AI-powered SQL assistance using Cohere.

## 🚀 Project Structure


## ✨ Features

### Backend
- 🔐 Django REST Framework API
- 🤖 AI-powered SQL query generation (Cohere)
- 👤 User authentication & authorization
- 📝 Query history tracking
- 🗄️ PostgreSQL database support
- 🔒 Production-ready security configuration

### Frontend
- 💻 Modern JavaScript/React interface
- 🎨 Interactive database management UI
- ⚡ Real-time query execution
- 🧠 AI-assisted SQL generation

## 🛠️ Tech Stack

**Backend:**
- Django 5.0
- Django REST Framework
- PostgreSQL / SQLite
- Cohere AI API
- Gunicorn + WhiteNoise

**Frontend:**
- JavaScript/React
- Modern UI components

## 📋 Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js (for frontend)
- PostgreSQL (for production)
- Cohere API Key

### Backend Setup

1. Navigate to backend:

2. Create virtual environment:

3. Install dependencies:

4. Create `.env` file in root directory (`infradb/.env`):

5. Run migrations:

6. Create superuser:

7. Run backend server:

Backend API: `http://127.0.0.1:8000/`

### Frontend Setup

1. Navigate to frontend:

2. Install dependencies:

3. Run frontend:

Frontend UI: `http://localhost:3000/`

## 🚢 Production Deployment

### Environment Variables (Production)
Set these in your hosting platform:
- `SECRET_KEY`: Django secret key (generate new)
- `DEBUG`: False
- `ALLOWED_HOSTS`: yourdomain.com
- `COHERE_API_KEY`: Your API key
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`: PostgreSQL credentials

### Deploy Backend

### Deploy Frontend
Serve the `build` folder with Nginx/Apache or CDN.

## 🔐 Security Features
- ✅ Environment-based configuration
- ✅ HTTPS enforcement in production
- ✅ Secure session & cookie settings
- ✅ CSRF & XSS protection
- ✅ SQL injection prevention
- ✅ Secrets stored in environment variables

## 🤖 AI Integration
Powered by **Cohere AI** for intelligent SQL query generation, natural language to SQL conversion, and database assistance.

## 📂 Project Highlights
- Separation of development and production settings
- Database query history tracking
- AI-powered query suggestions
- User-friendly database management interface
- Scalable architecture ready for 1000+ users

## 📝 License
MIT License

## 👨‍💻 Author
**Partha Chakraborty**  
Full Stack Developer | Database Systems Specialist  
AI Integration & Production Architecture

## 🔗 Links
- **GitHub**: https://github.com/partha-hue/infradb
- **Portfolio**: [Your portfolio link]
- **LinkedIn**: [Your LinkedIn]

---

⭐ **Star this repository if you find it useful!**
