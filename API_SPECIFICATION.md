# Clio Voice Notes API Specification

## Overview

The Clio Voice Notes API provides a comprehensive RESTful interface for an AI-powered voice transcription and note-taking platform. The API enables users to record audio, automatically transcribe it using OpenAI's Whisper with intelligent text formatting, manage notes with tagging, perform advanced search operations, and retry failed transcriptions.

## Base URL

- **Development**: `http://localhost:8011/api/`
- **Production**: `https://your-domain.com/api/`

## Authentication

The API uses JWT (JSON Web Token) authentication with access and refresh tokens.

### Authentication Flow

1. **Register/Login** to get tokens
2. **Include access token** in Authorization header: `Bearer <access_token>`
3. **Refresh tokens** when access token expires

## API Endpoints

### Authentication Endpoints

#### Register User
```
POST /auth/register/
```

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "date_joined": "2024-01-15T10:30:00Z",
      "profile": {
        "username": "john_doe",
        "email": "john@example.com",
        "preferred_language": "en-US",
        "audio_quality": "high",
        "storage_quota_mb": 1000,
        "storage_used_mb": 0.0,
        "storage_percentage": 0.0,
        "created_at": "2024-01-15T10:30:00Z"
      }
    },
    "tokens": {
      "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
      "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
    }
  }
}
```

#### Login
```
POST /auth/login/
```

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

#### Refresh Token
```
POST /auth/refresh/
```

**Request Body:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

#### Logout
```
POST /auth/logout/
```

**Request Body:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

#### User Profile
```
GET /auth/profile/
PUT /auth/profile/
PATCH /auth/profile/
```

**GET Response:**
```json
{
  "success": true,
  "data": {
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "preferred_language": "en-US",
    "audio_quality": "high",
    "storage_quota_mb": 1000,
    "storage_used_mb": 45.7,
    "storage_percentage": 4.6,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Voice Notes Endpoints

#### List/Create Voice Notes
```
GET /notes/
POST /notes/
```

**GET Parameters:**
- `page` - Page number (default: 1)
- `page_size` - Items per page (default: 20)
- `search` - Search in title and transcription
- `status` - Filter by status (processing, completed, failed)
- `language_detected` - Filter by detected language
- `is_favorite` - Filter favorites (true/false)
- `tags` - Filter by tag IDs (comma-separated)
- `ordering` - Sort by field (created_at, updated_at, title, duration)

**GET Response (200 OK):**
```json
{
  "count": 25,
  "next": "http://localhost:8011/api/notes/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Meeting notes from client call",
      "username": "john_doe",
      "status": "completed",
      "duration": "00:05:30",
      "file_size_mb": 8.5,
      "language_detected": "en",
      "confidence_score": 0.95,
      "is_favorite": true,
      "tags": [
        {
          "id": 1,
          "name": "work",
          "color": "#3B82F6",
          "created_at": "2024-01-15T10:30:00Z"
        }
      ],
      "created_at": "2024-01-15T14:22:00Z",
      "updated_at": "2024-01-15T14:25:00Z"
    }
  ]
}
```

**POST Request (multipart/form-data):**
```json
{
  "audio_file": "<binary_audio_file>",
  "title": "Meeting notes",
  "tag_ids": [1, 2]
}
```

**POST Response (201 Created):**
```json
{
  "success": true,
  "message": "Voice note created successfully. Transcription in progress.",
  "data": {
    "id": 1,
    "title": "Meeting notes",
    "transcription": "",
    "username": "john_doe",
    "audio_file": "/media/audio/1/meeting_notes.wav",
    "audio_url": "http://localhost:8011/media/audio/1/meeting_notes.wav",
    "duration": null,
    "file_size_mb": 8.5,
    "language_detected": "auto",
    "confidence_score": null,
    "status": "processing",
    "error_message": "",
    "is_favorite": false,
    "tags": [],
    "segments": [],
    "created_at": "2024-01-15T14:22:00Z",
    "updated_at": "2024-01-15T14:22:00Z"
  }
}
```

#### Voice Note Detail
```
GET /notes/{id}/
PUT /notes/{id}/
PATCH /notes/{id}/
DELETE /notes/{id}/
```

**GET Response (200 OK):**
```json
{
  "id": 1,
  "title": "Meeting notes from client call",
  "transcription": "Hello everyone, this is our weekly client meeting.\n\nWe discussed the project timeline and the key deliverables for next month. The client seemed satisfied with our progress and approved the next phase of development.",
  "username": "john_doe",
  "audio_file": "/media/audio/1/meeting_notes.wav",
  "audio_url": "http://localhost:8011/media/audio/1/meeting_notes.wav",
  "duration": "00:05:30",
  "file_size_mb": 8.5,
  "language_detected": "en",
  "confidence_score": 0.95,
  "status": "completed",
  "error_message": "",
  "is_favorite": true,
  "tags": [
    {
      "id": 1,
      "name": "work",
      "color": "#3B82F6",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "segments": [
    {
      "id": 1,
      "start_time": 0.0,
      "end_time": 3.2,
      "duration": 3.2,
      "text": "Hello everyone, this is our weekly client meeting.",
      "confidence": 0.98,
      "speaker_id": ""
    },
    {
      "id": 2,
      "start_time": 3.2,
      "end_time": 8.5,
      "duration": 5.3,
      "text": "We discussed the project timeline and the key deliverables for next month.",
      "confidence": 0.94,
      "speaker_id": ""
    }
  ],
  "created_at": "2024-01-15T14:22:00Z",
  "updated_at": "2024-01-15T14:25:00Z"
}
```

**PUT/PATCH Request:**
```json
{
  "title": "Updated meeting notes",
  "transcription": "Updated transcription text",
  "is_favorite": true,
  "tag_ids": [1, 3]
}
```

**DELETE Response (200 OK):**
```json
{
  "success": true,
  "message": "Voice note deleted successfully"
}
```

#### Re-transcribe Voice Note (NEW)
```
POST /notes/{id}/retranscribe/
```

This endpoint allows users to retry transcription for failed voice notes or re-transcribe with different language settings.

**Request Body:**
```json
{
  "language": "en"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Re-transcription started successfully",
  "data": {
    "id": 1,
    "title": "Meeting notes from client call",
    "transcription": "",
    "status": "processing",
    "language_detected": "en",
    "error_message": "",
    "updated_at": "2024-01-15T15:30:00Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Cannot retranscribe note that is currently processing",
  "errors": {
    "status": ["Note must be in 'failed' or 'completed' status to retranscribe"]
  }
}
```

### Tags Endpoints

#### List/Create Tags
```
GET /tags/
POST /tags/
```

**GET Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "work",
    "color": "#3B82F6",
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "name": "personal",
    "color": "#EF4444",
    "created_at": "2024-01-15T10:31:00Z"
  }
]
```

**POST Request:**
```json
{
  "name": "meetings",
  "color": "#10B981"
}
```

#### Tag Detail
```
GET /tags/{id}/
PUT /tags/{id}/
PATCH /tags/{id}/
DELETE /tags/{id}/
```

### Audio Processing Endpoints

#### Transcribe Audio (Real-time)
```
POST /transcribe/
```

**Request (multipart/form-data):**
```json
{
  "audio_file": "<binary_audio_file>",
  "language": "en"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transcription": "This is the transcribed text from the audio file with intelligent formatting.\n\nParagraphs are automatically created based on natural speech patterns and timing.",
    "language": "en",
    "duration": 30.5,
    "confidence": 0.92,
    "segments": [
      {
        "start_time": 0.0,
        "end_time": 15.2,
        "text": "This is the transcribed text from the audio file with intelligent formatting.",
        "confidence": 0.95
      },
      {
        "start_time": 16.1,
        "end_time": 30.5,
        "text": "Paragraphs are automatically created based on natural speech patterns and timing.",
        "confidence": 0.89
      }
    ]
  }
}
```

#### User Statistics (NEW)
```
GET /stats/
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_notes": 15,
    "completed_notes": 12,
    "processing_notes": 2,
    "failed_notes": 1,
    "favorite_notes": 5,
    "total_duration_seconds": 1850.5,
    "languages_used": ["en", "es", "fr"],
    "storage_used_mb": 245.7,
    "storage_quota_mb": 1000,
    "storage_percentage": 24.6,
    "success_rate": 85.7,
    "average_confidence": 0.91
  }
}
```

## Data Models

### VoiceNote Model
```json
{
  "id": "integer",
  "user": "foreign_key",
  "title": "string(255)",
  "transcription": "text",
  "audio_file": "file_field",
  "duration": "duration",
  "file_size_bytes": "positive_big_integer",
  "language_detected": "string(10)",
  "confidence_score": "float(0.0-1.0)",
  "status": "string(processing|completed|failed)",
  "error_message": "text",
  "tags": "many_to_many",
  "is_favorite": "boolean",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Tag Model
```json
{
  "id": "integer",
  "name": "string(50)",
  "color": "string(7)",
  "created_at": "datetime"
}
```

### TranscriptionSegment Model
```json
{
  "id": "integer",
  "voice_note": "foreign_key",
  "start_time": "float",
  "end_time": "float",
  "text": "text",
  "confidence": "float",
  "speaker_id": "string(50)"
}
```

### UserProfile Model
```json
{
  "id": "integer",
  "user": "one_to_one",
  "preferred_language": "string(10)",
  "audio_quality": "string(10)",
  "storage_quota_mb": "positive_integer",
  "storage_used_mb": "float",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## AI Transcription Features

### OpenAI Whisper Configuration

Clio uses OpenAI's Whisper API with configurable settings:

**Environment Variables:**
```env
WHISPER_MODEL=whisper-1
WHISPER_TEMPERATURE=0
WHISPER_FORMAT_TEXT=true
WHISPER_PARAGRAPH_BREAK_SECONDS=2.0
WHISPER_MAX_SENTENCE_LENGTH=150
```

**Features:**
- **Model Selection**: Choose between Whisper models
- **Temperature Control**: Adjust randomness in transcription
- **Text Formatting**: Automatic paragraph creation from wall-of-text
- **Timing Analysis**: Use segment timing for intelligent formatting
- **Confidence Scoring**: Track transcription accuracy

### Intelligent Text Formatting

Clio automatically formats transcription output:

**Before (Raw Whisper Output):**
```
Hello everyone this is our weekly meeting we need to discuss the project timeline and deliverables the client wants to see progress on the frontend development and we should also talk about the database optimization issues that came up last week
```

**After (Clio Formatting):**
```
Hello everyone, this is our weekly meeting. We need to discuss the project timeline and deliverables.

The client wants to see progress on the frontend development and we should also talk about the database optimization issues that came up last week.
```

**Formatting Rules:**
- Paragraph breaks based on speech pauses (configurable threshold)
- Proper sentence capitalization and punctuation
- Maximum sentence length limits
- Natural language flow preservation

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field_name": ["Error message"],
    "non_field_errors": ["General error message"]
  }
}
```

### HTTP Status Codes
- `200 OK` - Successful GET, PUT, PATCH, DELETE
- `201 Created` - Successful POST
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found
- `413 Payload Too Large` - File size exceeds limit
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Server error

### Transcription Error Handling

**Common Error Scenarios:**
```json
{
  "success": false,
  "message": "Transcription failed",
  "errors": {
    "transcription": ["Audio file format not supported"],
    "audio_file": ["File size exceeds 50MB limit"]
  }
}
```

**Retry Mechanism:**
- Failed transcriptions can be retried via `/notes/{id}/retranscribe/`
- Different language settings can be applied
- Automatic error logging for debugging

## File Upload Specifications

### Audio File Requirements
- **Max Size**: 50MB
- **Supported Formats**: WAV, MP3, M4A, OGG, WebM, FLAC
- **Recommended Quality**: 16kHz or 44.1kHz sample rate
- **Content-Type**: Proper MIME type required

### File Storage
- Audio files stored in `/media/audio/{user_id}/` directory
- Secure URLs with authentication required for access
- HTTP Range request support for streaming playback
- Custom MIME type handling for cross-browser compatibility

## Rate Limiting

- **Authentication endpoints**: 10 requests/minute
- **File upload endpoints**: 5 requests/minute
- **General API endpoints**: 100 requests/minute
- **Transcription endpoint**: 10 requests/minute
- **Retranscription endpoint**: 3 requests/minute

## Security Considerations

- HTTPS required in production
- JWT tokens with short expiration times
- File upload validation and size limits
- CORS headers configured for specific origins
- Rate limiting and request size limits
- Input validation and sanitization
- Audio file streaming with authentication

## Testing

Use the interactive API documentation available at:
- **Swagger UI**: `http://localhost:8011/api/docs/`
- **ReDoc**: `http://localhost:8011/api/redoc/`
- **OpenAPI Schema**: `http://localhost:8011/api/schema/`

## Support

For API support and bug reports:
- **GitHub Issues**: [Create an issue](https://github.com/your-username/clio/issues)
- **Documentation**: This API specification
- **Community**: GitHub Discussions

---

**Clio - AI-Powered Voice Transcription Platform**