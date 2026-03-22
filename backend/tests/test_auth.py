import pytest
from django.contrib.auth.models import User
from rest_framework import status


@pytest.mark.django_db
class TestRegistration:
    def test_register_valid(self, api_client):
        data = {
            'username': 'newuser',
            'email': 'new@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        }
        resp = api_client.post('/api/auth/register/', data, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['success'] is True
        assert 'tokens' in resp.data['data']
        assert 'access' in resp.data['data']['tokens']
        assert 'refresh' in resp.data['data']['tokens']
        assert User.objects.filter(username='newuser').exists()

    def test_register_duplicate_username(self, api_client, user):
        data = {
            'username': 'testuser',  # already exists via fixture
            'email': 'dup@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        }
        resp = api_client.post('/api/auth/register/', data, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_password_mismatch(self, api_client):
        data = {
            'username': 'newuser2',
            'email': 'new2@example.com',
            'password': 'StrongPass123!',
            'password_confirm': 'DifferentPass123!',
        }
        resp = api_client.post('/api/auth/register/', data, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    def test_login_valid(self, api_client, user):
        resp = api_client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert 'access' in resp.data
        assert 'refresh' in resp.data

    def test_login_invalid(self, api_client, user):
        resp = api_client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'wrongpassword'},
            format='json',
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestProfile:
    def test_profile_requires_auth(self, api_client):
        resp = api_client.get('/api/auth/profile/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_profile_authenticated(self, authenticated_client):
        resp = authenticated_client.get('/api/auth/profile/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['success'] is True
        assert resp.data['data']['username'] == 'testuser'

    def test_storage_quota_readonly(self, authenticated_client):
        resp = authenticated_client.patch(
            '/api/auth/profile/',
            {'storage_quota_mb': 99999},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        # storage_quota_mb should still be default (1000), not 99999
        resp2 = authenticated_client.get('/api/auth/profile/')
        assert resp2.data['data']['storage_quota_mb'] == 1000


@pytest.mark.django_db
class TestHealthCheck:
    def test_health_no_auth(self, api_client):
        resp = api_client.get('/api/health/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['status'] == 'ok'
