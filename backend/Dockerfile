FROM python:3.9

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies + debugging tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        libpq-dev \
        ffmpeg \
        # Debugging & diagnostic tools
        curl \
        wget \
        vim \
        nano \
        less \
        htop \
        strace \
        lsof \
        net-tools \
        iputils-ping \
        dnsutils \
        tcpdump \
        procps \
        jq \
        tree \
        git \
        gdb \
        ncurses-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Python debugging tools
RUN pip install --no-cache-dir \
    ipdb \
    ipython \
    django-extensions \
    rich

# Create media directory for uploaded files
RUN mkdir -p /app/media/audio

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/', timeout=10)" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "config.wsgi:application"]
