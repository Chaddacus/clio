# Clio - AI-Powered Voice Transcription Platform

[![CI](https://github.com/Chaddacus/clio/actions/workflows/ci.yml/badge.svg)](https://github.com/Chaddacus/clio/actions/workflows/ci.yml)

A comprehensive voice transcription and note-taking platform that leverages advanced AI technology with real-time speech-to-text capabilities using OpenAI's Whisper API. Built with Django REST Framework backend and React TypeScript frontend.

For production deployment, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## ✨ Features

### 🎙️ Audio Recording & Processing
- **Real-time microphone access** using Web Audio API
- **Visual waveform display** during recording with audio level monitoring
- **Pause/resume functionality** with seamless recording experience
- **High-quality audio capture** supporting up to 44.1kHz sample rates
- **Multi-format support**: WAV, MP3, M4A, OGG, WebM, FLAC
- **Performance optimization** for smooth recording experience

### 🤖 AI-Powered Transcription
- **OpenAI Whisper integration** for accurate speech-to-text conversion
- **Intelligent text formatting** - converts wall-of-text into readable paragraphs
- **Multi-language support** with automatic language detection
- **Confidence scoring** for transcription accuracy tracking
- **Timestamped transcript segments** with timing analysis
- **Environment-configurable Whisper settings** (model, temperature, formatting)
- **Segment-based paragraph breaks** using speech pause detection

### 📝 Advanced Note Management
- **Create, edit, and organize** voice notes with ease
- **Tag-based categorization** system with color-coded labels
- **Favorites system** for important notes
- **Advanced search functionality** across titles and transcriptions
- **Filtering and sorting** by status, language, tags, and favorites
- **Audio playback** synchronized with transcription segments
- **Retry transcription** functionality for failed notes

### 👤 User Management & Analytics
- **JWT-based authentication** with secure token management
- **User profiles** with customizable preferences
- **Storage quota management** with usage tracking
- **User statistics dashboard** showing success rates and analytics
- **Preferred language settings** and audio quality preferences

### 🔄 Smart Error Handling & Recovery
- **Automatic retry mechanisms** for failed transcriptions
- **Re-transcribe functionality** with different language settings
- **Comprehensive error logging** and user feedback
- **Graceful degradation** for network issues

## 🛠️ Tech Stack

### Backend
- **Django 4.2+** with Django REST Framework
- **PostgreSQL** database with optimized queries
- **OpenAI Whisper API** for transcription with intelligent formatting
- **JWT Authentication** with refresh token support
- **Docker** containerization for development and production
- **Python-decouple** for environment configuration

### Frontend
- **React 18+** with TypeScript for type safety
- **Tailwind CSS** for responsive styling
- **Web Audio API** for real-time recording
- **React Query** for efficient state management
- **React Router** for navigation
- **Axios** for API communication with interceptors

### Infrastructure
- **Docker Compose** for multi-container orchestration
- **Nginx** reverse proxy configuration
- **Custom audio streaming** with Range request support
- **CORS configuration** for secure cross-origin requests

## 📁 Project Structure

```
clio/
├── backend/
│   ├── config/                 # Django settings and URL configuration
│   ├── apps/
│   │   ├── core/              # Shared utilities and AI services
│   │   ├── api/               # REST API endpoints
│   │   ├── users/             # User management and authentication
│   │   └── voice_notes/       # Voice notes and transcription logic
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/        # React components (Audio, Layout, Notes)
│   │   ├── pages/             # Page-level components
│   │   ├── hooks/             # Custom React hooks for recording and audio
│   │   ├── services/          # API communication services
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Utility functions and helpers
│   ├── e2e/                   # End-to-end tests with Playwright
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
├── LICENSE
├── API_SPECIFICATION.md
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Docker** and **Docker Compose**
- **OpenAI API key** ([Get yours here](https://platform.openai.com/api-keys))
- **Modern web browser** with microphone support

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/clio.git
   cd clio
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key and other configuration
   ```

   ⚠️ **IMPORTANT**: You must add your actual OpenAI API key to the `.env` file:
   - Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Replace `your-openai-api-key-here` with your actual key
   - Never commit your real API key to version control

3. **Start the development environment:**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations:**
   ```bash
   docker-compose exec backend python manage.py migrate
   ```

5. **Create a superuser (optional):**
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

6. **Access the application:**
   - **Frontend**: http://localhost:3011
   - **Backend API**: http://localhost:8011
   - **Admin Panel**: http://localhost:8011/admin
   - **API Documentation**: http://localhost:8011/api/docs/

### Production Deployment

1. **Set up production environment:**
   ```bash
   cp .env.example .env
   # Configure production settings in .env
   ```

   🔒 **SECURITY**: In production, make sure to:
   - Use a strong, unique `SECRET_KEY`
   - Set `DEBUG=False`
   - Use secure database credentials
   - Configure proper `ALLOWED_HOSTS`
   - Never expose your `.env` file publicly

2. **Deploy with production compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## ⚙️ Configuration

### Environment Variables

The application supports extensive configuration through environment variables:

```env
# Backend Configuration
SECRET_KEY=your-very-secure-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database Configuration
DB_NAME=clio_db
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_HOST=db
DB_PORT=5432

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Whisper Transcription Settings
WHISPER_MODEL=whisper-1
WHISPER_TEMPERATURE=0
WHISPER_FORMAT_TEXT=true
WHISPER_PARAGRAPH_BREAK_SECONDS=2.0
WHISPER_MAX_SENTENCE_LENGTH=150

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8011/api
```

### Audio & Transcription Settings
- **Supported formats:** WAV, MP3, M4A, OGG, WebM, FLAC
- **Maximum file size:** 50MB per recording
- **Sample rates:** 8kHz (low), 16kHz (medium), 44.1kHz (high)
- **Intelligent formatting:** Automatic paragraph creation with configurable timing thresholds

## 📖 API Documentation

Comprehensive API documentation is available at:
- **Interactive Swagger UI:** `http://localhost:8011/api/docs/`
- **Alternative ReDoc:** `http://localhost:8011/api/redoc/`
- **OpenAPI Schema:** `http://localhost:8011/api/schema/`
- **Detailed Specification:** [API_SPECIFICATION.md](./API_SPECIFICATION.md)

### Key API Endpoints

```bash
# Authentication
POST /api/auth/register/     # User registration
POST /api/auth/login/        # User login
POST /api/auth/refresh/      # Token refresh

# Voice Notes
GET  /api/notes/             # List voice notes (with search & filters)
POST /api/notes/             # Create new voice note with audio upload
GET  /api/notes/{id}/        # Get voice note details with segments
POST /api/notes/{id}/retranscribe/  # Retry failed transcriptions

# Statistics & Analytics
GET  /api/stats/             # User statistics and usage analytics

# Transcription
POST /api/transcribe/        # Standalone audio transcription
```

## 🎯 Key Features Implementation

### Intelligent Text Formatting

Clio automatically transforms raw Whisper output into readable text:

**Before (Raw Whisper Output):**
```
hello everyone this is our weekly meeting we need to discuss the project timeline and deliverables the client wants to see progress on the frontend development and we should also talk about the database optimization issues that came up last week
```

**After (Clio Formatting):**
```
Hello everyone, this is our weekly meeting. We need to discuss the project timeline and deliverables.

The client wants to see progress on the frontend development and we should also talk about the database optimization issues that came up last week.
```

### Audio Recording with Web Audio API
```typescript
// Custom hook for audio recording
const recorder = useAudioRecorder({
  onRecordingComplete: (audioBlob) => {
    // Handle completed recording with intelligent processing
  },
  onError: (error) => {
    // Comprehensive error handling with user feedback
  },
});

// Start recording with performance optimization
await recorder.startRecording();
```

### AI Transcription Service Integration
```python
# OpenAI Whisper service with intelligent formatting
class WhisperTranscriptionService:
    def transcribe_audio(self, audio_file, language='auto'):
        response = openai.audio.transcriptions.create(
            model=self.model,
            file=audio_file,
            temperature=self.temperature,
            response_format="verbose_json"
        )
        
        # Apply intelligent text formatting
        formatted_text = self.text_formatter.format_transcription(
            response.text, response.segments
        )
        
        return formatted_text
```

## 🔐 Security Features

- **HTTPS enforcement** in production
- **JWT authentication** with short-lived access tokens
- **Secure file upload** validation and size limits
- **CORS configuration** for specific origins only
- **Rate limiting** on API endpoints
- **Input validation** and sanitization
- **Audio streaming authentication** with Range request support

## ⚡ Performance Optimizations

### Backend Optimizations
- **Database indexing** on frequently queried fields
- **Query optimization** with select_related and prefetch_related
- **Caching strategies** for static content
- **Async processing** for transcription tasks
- **Intelligent text formatting** with configurable parameters

### Frontend Optimizations
- **React.lazy()** for component code splitting
- **React.memo** and **useMemo** for expensive computations
- **Performance monitoring** with custom hooks
- **Optimized audio handling** with Web Audio API
- **Efficient state management** with React Query

## 🌍 Browser Compatibility

- **Chrome 80+** ✅ (Recommended - best performance)
- **Firefox 75+** ✅ (Full feature support)
- **Safari 13+** ✅ (macOS microphone access optimized)
- **Edge 80+** ✅ (Windows compatibility)

**Note:** Microphone access requires HTTPS in production environments.

## 🧪 Testing

### Backend (pytest-django)
- 25+ tests covering auth, voice notes, serializers, API contracts
- Runs against SQLite in CI, PostgreSQL in Docker

### Frontend (Playwright E2E)
- Auth setup: register + login with storage state persistence
- Dashboard, profile, and health check specs
- Login-first flow per CLAUDE.md requirements

### Running Tests
```bash
# Backend tests
cd backend && pytest --cov=apps

# Linting
cd backend && ruff check .

# E2E tests (requires running app)
cd frontend && npx playwright test --project=chromium

# Frontend build check
cd frontend && npm ci && npm run build
```

### CI
GitHub Actions runs on every PR: backend lint + test, frontend build, Playwright E2E.

## 🐛 Troubleshooting

### Common Issues

1. **Microphone not working:**
   - Ensure HTTPS in production environments
   - Grant microphone permissions in browser settings
   - Check browser compatibility and version
   - Verify no other applications are using the microphone

2. **Transcription failing:**
   - Verify OpenAI API key is correctly set in `.env`
   - Check audio file format and size (max 50MB)
   - Monitor OpenAI API rate limits and quota
   - Use the retranscribe functionality for failed attempts

3. **Docker issues:**
   - Ensure Docker daemon is running
   - Check port availability (3011 for frontend, 8011 for backend, 5435 for database)
   - Verify all environment variables are set correctly
   - Check Docker logs for specific error messages

4. **Audio playback issues:**
   - Verify CORS settings for media file access
   - Check network connectivity for streaming
   - Ensure proper MIME types are configured
   - Test with different audio formats

### Logs and Debugging

```bash
# View backend logs
docker-compose logs backend

# View frontend logs  
docker-compose logs frontend

# View database logs
docker-compose logs db

# Access Django shell for debugging
docker-compose exec backend python manage.py shell

# Connect to PostgreSQL database
docker-compose exec db psql -U postgres -d clio_db

# Monitor real-time logs
docker-compose logs -f backend frontend
```

### Performance Debugging

```bash
# Check audio processing performance
# Browser DevTools → Performance tab during recording

# Monitor API response times
# Network tab in browser DevTools

# Database query analysis
docker-compose exec backend python manage.py shell
>>> from django.db import connection
>>> print(connection.queries)
```

## 🤝 Contributing

We welcome contributions to Clio! Please follow these guidelines:

1. **Fork the repository** and create your feature branch
2. **Follow coding standards:**
   - Backend: PEP 8 Python style guide
   - Frontend: ESLint with TypeScript rules
   - Use Prettier for consistent formatting
3. **Write comprehensive tests** for new functionality
4. **Update documentation** for significant changes
5. **Submit a pull request** with detailed description

### Development Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test thoroughly
npm test && docker-compose exec backend python manage.py test

# Submit pull request with tests and documentation
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🌟 Roadmap

### Upcoming Features
- [ ] **Real-time collaborative transcription** with multi-user support
- [ ] **Voice note sharing** and collaboration features  
- [ ] **Advanced search** with semantic matching and AI-powered insights
- [ ] **Mobile app** using React Native for iOS and Android
- [ ] **Offline transcription** capabilities with local AI models
- [ ] **Cloud storage integration** (Google Drive, Dropbox, OneDrive)
- [ ] **Voice note templates** and automated shortcuts
- [ ] **Advanced audio processing** with noise reduction and enhancement
- [ ] **Speaker identification** and multi-speaker transcription
- [ ] **Custom vocabulary** and domain-specific language models

### Technical Improvements
- [ ] **WebSocket support** for real-time transcription updates
- [ ] **Microservices architecture** for better scalability
- [ ] **Redis caching** for improved performance
- [ ] **CDN integration** for global content delivery
- [ ] **Advanced analytics** and user insights dashboard

## 💬 Support

For support, questions, and discussions:

- **📝 GitHub Issues**: [Report bugs and request features](https://github.com/your-username/clio/issues)
- **💬 GitHub Discussions**: [Community discussions](https://github.com/your-username/clio/discussions)
- **📚 Documentation**: Check this README and API specification
- **🔗 API Reference**: Interactive docs at `/api/docs/`

## 🙏 Acknowledgments

- **OpenAI** for the Whisper API that powers our transcription capabilities
- **Django** and **Django REST Framework** for the robust backend framework
- **React** and **TypeScript** communities for excellent frontend tools
- **Tailwind CSS** for the beautiful and responsive design system
- **Docker** for containerization and deployment simplification

---

**Built with ❤️ using Django, React, and OpenAI Whisper**

**Clio - Transform your voice into perfectly formatted text with the power of AI**