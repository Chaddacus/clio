from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    LANGUAGE_CHOICES = [
        ('en-US', 'English (US)'),
        ('en-GB', 'English (GB)'),
        ('es-ES', 'Spanish'),
        ('fr-FR', 'French'),
        ('de-DE', 'German'),
        ('it-IT', 'Italian'),
        ('pt-PT', 'Portuguese'),
        ('ja-JP', 'Japanese'),
        ('ko-KR', 'Korean'),
        ('zh-CN', 'Chinese (Simplified)'),
    ]

    AUDIO_QUALITY_CHOICES = [
        ('low', 'Low (8kHz)'),
        ('medium', 'Medium (16kHz)'),
        ('high', 'High (44.1kHz)'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    preferred_language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
        default='en-US'
    )
    audio_quality = models.CharField(
        max_length=10,
        choices=AUDIO_QUALITY_CHOICES,
        default='high'
    )
    storage_quota_mb = models.PositiveIntegerField(default=1000)
    storage_used_mb = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
