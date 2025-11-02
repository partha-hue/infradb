# InfraDB - Database Management System

A production-ready Django-based Database Management System with AI-powered query assistance using Cohere.

## Features
- Custom database management interface
- AI-powered SQL query generation (Cohere integration)
- User authentication and authorization
- Query history tracking
- Production-ready configuration
- Secure environment variable handling

## Tech Stack
- **Backend**: Django 5.0
- **Database**: SQLite (Development), PostgreSQL (Production)
- **AI Integration**: Cohere API
- **Web Server**: Gunicorn + WhiteNoise

## Setup Instructions

### Prerequisites
- Python 3.8+
- PostgreSQL (for production)
- Cohere API Key

### Local Development

1. **Clone the repository:**

2. **Create virtual environment:**

3. **Install dependencies:**

4. **Create `.env` file in backend directory:**

5. **Run migrations:**

6. **Create superuser:**

7. **Run development server:**

Visit `http://127.0.0.1:8000/`

## Production Deployment

### Environment Variables
Set these in your production environment:
- `SECRET_KEY`: Django secret key (generate new for production)
- `DEBUG`: False
- `ALLOWED_HOSTS`: Your domain name
- `COHERE_API_KEY`: Your Cohere API key
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`: PostgreSQL credentials

### Deploy with Gunicorn

## Project Structure

## Security Features
- ✅ Environment-based configuration
- ✅ HTTPS enforcement in production
- ✅ Secure cookie settings
- ✅ CSRF protection
- ✅ XSS protection headers
- ✅ SQL injection prevention
- ✅ Secrets stored in environment variables

## API Integration
This project uses Cohere AI for intelligent SQL query generation and assistance.

## License
MIT License

## Author
[Partha Chakraborty] - Full Stack Developer specializing in Django & Database Systems
