"""Translations module: stored translations of a voice note's transcript.

A translation is a derived artifact. It never replaces the note's transcript
or segments; it lives beside them, one row per (note, target language). The
row carries the provider/model/prompt version that produced it so a behaviour
change can be traced and re-run (Standard 9: versioned AI behaviour).
"""
from django.db import models

from apps.voice_notes.models import VoiceNote

# Target languages the user can pick. Mirrors VoiceNote.LANGUAGE_CHOICES minus
# 'auto', which is not a target.
TARGET_LANGUAGE_CHOICES = [
    (code, label) for code, label in VoiceNote.LANGUAGE_CHOICES if code != 'auto'
]


class NoteTranslation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    voice_note = models.ForeignKey(VoiceNote, on_delete=models.CASCADE, related_name='translations')
    target_language = models.CharField(max_length=10, choices=TARGET_LANGUAGE_CHOICES)
    source_language = models.CharField(
        max_length=10, blank=True, default='',
        help_text="Language of the transcript at translation time (detected code or 'auto').",
    )
    text = models.TextField(blank=True, default='')
    segments = models.JSONField(
        default=list, blank=True,
        help_text="[{'segment_id': int, 'text': str}] aligned to TranscriptionSegment rows; "
                  "empty when the note has no segments.",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, default='')

    # Provenance for versioned AI behaviour.
    provider = models.CharField(max_length=40, blank=True, default='')
    model = models.CharField(max_length=80, blank=True, default='')
    prompt_version = models.CharField(max_length=20, blank=True, default='')
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['target_language']
        constraints = [
            models.UniqueConstraint(
                fields=['voice_note', 'target_language'], name='unique_translation_per_note_language'
            ),
        ]

    def __str__(self):
        return f"{self.voice_note_id} -> {self.target_language} ({self.status})"
