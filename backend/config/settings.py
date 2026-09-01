from datetime import timedelta
from pathlib import Path

from decouple import config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-only-key')
DEBUG = config('DEBUG', default=False, cast=bool)

if not DEBUG and 'insecure' in SECRET_KEY:
    raise ImproperlyConfigured(
        'You must set a secure SECRET_KEY when DEBUG=False.'
    )

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=lambda v: [s.strip() for s in v.split(',')])

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
]

LOCAL_APPS = [
    'apps.core',
    'apps.api',
    'apps.voice_notes',
    'apps.users',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'apps.core.middleware.RequestIDMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='voice_notes_db'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='postgres'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.core.auth.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Generous caps for a small private app: high enough never to bite
        # legitimate use (login retries, the SPA's burst of requests on load),
        # low enough to still cap automated abuse. Env-tunable without a redeploy.
        'anon': config('THROTTLE_ANON_RATE', default='60/minute'),
        'user': config('THROTTLE_USER_RATE', default='1000/minute'),
    },
    'EXCEPTION_HANDLER': 'apps.core.exception_handler.custom_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Voice Notes API',
    'DESCRIPTION': 'API for voice note-taking application with real-time transcription',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3011",
    "http://127.0.0.1:3011",
    "https://clio.chadacus.dev",
]

CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='https://clio.chadacus.dev', cast=lambda v: [s.strip() for s in v.split(',')])

CORS_ALLOW_CREDENTIALS = True
# Range-streaming headers must be exposed to the browser for cross-origin audio
# playback (replaces the per-response Access-Control-Expose-Headers that the
# media views used to set manually alongside reflected-Origin CORS).
CORS_EXPOSE_HEADERS = [
    'X-Request-ID',
    'Content-Range',
    'Content-Length',
    'Accept-Ranges',
    'ETag',
    'Last-Modified',
]

CORS_ALLOW_ALL_ORIGINS = False

# Allow specific headers for media requests
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-request-id',  # browser-originated trace id (see RequestIDMiddleware); without it cross-origin note creation fails preflight
    'range',  # Important for audio/video streaming
]

OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
OPENAI_BASE_URL = config('OPENAI_BASE_URL', default='')

# Whisper Transcription Settings
WHISPER_MODEL = config('WHISPER_MODEL', default='whisper-1')
WHISPER_TEMPERATURE = config('WHISPER_TEMPERATURE', default=0, cast=float)
WHISPER_FORMAT_TEXT = config('WHISPER_FORMAT_TEXT', default=True, cast=bool)
WHISPER_PARAGRAPH_BREAK_SECONDS = config('WHISPER_PARAGRAPH_BREAK_SECONDS', default=2.0, cast=float)
WHISPER_MAX_SENTENCE_LENGTH = config('WHISPER_MAX_SENTENCE_LENGTH', default=150, cast=int)

# Deepgram speaker diarization. When DEEPGRAM_API_KEY is set, transcription
# routes through Deepgram (transcribe + diarize) so segments carry speaker
# labels; otherwise it falls back to the Whisper server configured above.
DEEPGRAM_API_KEY = config('DEEPGRAM_API_KEY', default='')
DEEPGRAM_MODEL = config('DEEPGRAM_MODEL', default='nova-3')
DEEPGRAM_BASE_URL = config('DEEPGRAM_BASE_URL', default='https://api.deepgram.com')

# Self-heal support pipeline. When GITHUB_TOKEN + GITHUB_REPO are set, a
# sufficient support request is turned into a `codex`-labelled GitHub issue;
# otherwise issue creation is a logged no-op (the request stays 'submitted').
GITHUB_TOKEN = config('GITHUB_TOKEN', default='')
GITHUB_REPO = config('GITHUB_REPO', default='Chaddacus/clio')
CODEX_LABEL = config('CODEX_LABEL', default='codex')

AUDIO_UPLOAD_MAX_SIZE = 50 * 1024 * 1024  # 50MB
AUDIO_ALLOWED_FORMATS = ['wav', 'mp3', 'ogg', 'webm', 'm4a']

# Celery
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# Transport security (enabled only in production)
if not DEBUG:
    # Traefik handles SSL termination — trust X-Forwarded-Proto header.
    # Kept inside the prod block: in DEBUG, honoring a client-supplied
    # X-Forwarded-Proto would let any caller fake request.is_secure().
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = False  # Traefik handles HTTPS redirect
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'request_id': {
            '()': 'apps.core.middleware.RequestIDFilter',
        },
    },
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s',
        },
        'console': {
            'format': '{asctime} {levelname} {name} [{request_id}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json' if not DEBUG else 'console',
            'filters': ['request_id'],
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
