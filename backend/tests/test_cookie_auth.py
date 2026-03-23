import pytest
from rest_framework import status


@pytest.mark.django_db
class TestCookieAuth:
    def test_login_sets_httponly_cookie(self, api_client, user):
        resp = api_client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert 'access_token' in resp.cookies
        cookie = resp.cookies['access_token']
        assert cookie['httponly'] is True
        assert cookie['path'] == '/'

    def test_register_sets_httponly_cookie(self, api_client):
        resp = api_client.post(
            '/api/auth/register/',
            {
                'username': 'cookieuser',
                'email': 'cookie@example.com',
                'first_name': 'Cookie',
                'last_name': 'User',
                'password': 'StrongPass123!',
                'password_confirm': 'StrongPass123!',
            },
            format='json',
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert 'access_token' in resp.cookies

    def test_cookie_authenticates_request(self, api_client, user):
        # Login to get cookie
        login_resp = api_client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        access_token = login_resp.cookies['access_token'].value

        # Make authenticated request using only the cookie (no Authorization header)
        api_client.cookies['access_token'] = access_token
        resp = api_client.get('/api/auth/profile/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['data']['username'] == 'testuser'

    def test_logout_clears_cookie(self, api_client, user):
        # Login first
        login_resp = api_client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        access_token = login_resp.cookies['access_token'].value
        refresh_token = login_resp.data['refresh']

        # Logout
        api_client.cookies['access_token'] = access_token
        api_client.force_authenticate(user=user)
        resp = api_client.post(
            '/api/auth/logout/',
            {'refresh_token': refresh_token},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        # Cookie should be cleared (max-age=0 or deleted)
        assert 'access_token' in resp.cookies
