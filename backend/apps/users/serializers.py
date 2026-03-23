from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'password', 'password_confirm')

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    storage_used_mb = serializers.FloatField(read_only=True)
    storage_percentage = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            'username', 'email', 'first_name', 'last_name',
            'preferred_language', 'audio_quality', 'storage_quota_mb',
            'storage_used_mb', 'storage_percentage', 'created_at'
        )
        read_only_fields = ('storage_used_mb', 'storage_quota_mb', 'created_at')

    def get_storage_percentage(self, obj):
        if obj.storage_quota_mb == 0:
            return 0
        return round(float(obj.storage_used_mb) / obj.storage_quota_mb * 100, 1)


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(source='userprofile', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'profile')
        read_only_fields = ('id', 'username', 'date_joined')
