import os
from django.contrib.auth.models import User
from django.db import models
from django.core.validators import FileExtensionValidator
from django.conf import settings


def audio_upload_path(instance, filename):
    return f'audio/{instance.user.id}/{filename}'


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default='#3B82F6')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']


class VoiceNote(models.Model):
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('es', 'Spanish'),
        ('fr', 'French'),
        ('de', 'German'),
        ('it', 'Italian'),
        ('pt', 'Portuguese'),
        ('ja', 'Japanese'),
        ('ko', 'Korean'),
        ('zh', 'Chinese'),
        ('auto', 'Auto-detect'),
    ]
    
    STATUS_CHOICES = [
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='voice_notes')
    title = models.CharField(max_length=255, blank=True, default='')
    transcription = models.TextField(blank=True)
    audio_file = models.FileField(
        upload_to=audio_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=settings.AUDIO_ALLOWED_FORMATS)],
        help_text=f"Allowed formats: {', '.join(settings.AUDIO_ALLOWED_FORMATS)}"
    )
    duration = models.DurationField(null=True, blank=True)
    file_size_bytes = models.PositiveBigIntegerField(default=0)
    language_detected = models.CharField(max_length=10, choices=LANGUAGE_CHOICES, default='auto')
    confidence_score = models.FloatField(null=True, blank=True, help_text="Transcription confidence (0.0-1.0)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='processing')
    error_message = models.TextField(blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='voice_notes')
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"
    
    @property
    def file_size_mb(self):
        return round(self.file_size_bytes / (1024 * 1024), 2)
    
    def save(self, *args, **kwargs):
        if self.audio_file and not self.file_size_bytes:
            self.file_size_bytes = self.audio_file.size
        
        if not self.title and self.transcription:
            words = self.transcription.split()[:10]
            self.title = ' '.join(words) + ('...' if len(words) == 10 else '')
        
        super().save(*args, **kwargs)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Voice Note'
        verbose_name_plural = 'Voice Notes'


class TranscriptionSegment(models.Model):
    voice_note = models.ForeignKey(VoiceNote, on_delete=models.CASCADE, related_name='segments')
    start_time = models.FloatField(help_text="Segment start time in seconds")
    end_time = models.FloatField(help_text="Segment end time in seconds")
    text = models.TextField()
    confidence = models.FloatField(null=True, blank=True)
    speaker_id = models.CharField(max_length=50, blank=True, help_text="Speaker identification")
    
    def __str__(self):
        return f"{self.voice_note.title} - {self.start_time}s-{self.end_time}s"
    
    @property
    def duration(self):
        return self.end_time - self.start_time
    
    class Meta:
        ordering = ['start_time']