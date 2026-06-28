from django.urls import path

from apps.voice_notes import views

urlpatterns = [
    path('notes/', views.VoiceNoteListCreateView.as_view(), name='voicenote-list-create'),
    path('notes/<int:pk>/', views.VoiceNoteDetailView.as_view(), name='voicenote-detail'),
    path('notes/<int:pk>/retranscribe/', views.retranscribe_voice_note, name='voicenote-retranscribe'),
    path('tags/', views.TagListCreateView.as_view(), name='tag-list-create'),
    path('tags/<int:pk>/', views.TagDetailView.as_view(), name='tag-detail'),
    path('folders/', views.FolderListCreateView.as_view(), name='folder-list-create'),
    path('folders/<int:pk>/', views.FolderDetailView.as_view(), name='folder-detail'),
    path('speakers/<int:pk>/', views.SpeakerDetailView.as_view(), name='speaker-detail'),
    path('transcribe/', views.transcribe_audio, name='transcribe-audio'),
    path('stats/', views.user_stats, name='user-stats'),
]
