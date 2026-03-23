import pytest
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestCookieAuth:
    @pytest.fixture(autouse=True)
    def fresh_client(self):
        """Each test gets a fresh client to avoid cookie bleed."""
        self.client = APIClient()

    def test_login_sets_both_httponly_cookies(self, user):
        resp = self.client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert 'access_token' in resp.cookies
        assert 'refresh_token' in resp.cookies
        assert resp.cookies['access_token']['httponly'] is True
        assert resp.cookies['refresh_token']['httponly'] is True

    def test_login_does_not_return_tokens_in_body(self, user):
        resp = self.client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert 'access' not in resp.data
        assert 'refresh' not in resp.data

    def test_register_sets_both_cookies(self):
        resp = self.client.post(
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
        assert 'refresh_token' in resp.cookies

    def test_register_does_not_return_tokens_in_body(self):
        resp = self.client.post(
            '/api/auth/register/',
            {
                'username': 'cookieuser2',
                'email': 'cookie2@example.com',
                'first_name': 'Cookie',
                'last_name': 'User',
                'password': 'StrongPass123!',
                'password_confirm': 'StrongPass123!',
            },
            format='json',
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert 'tokens' not in resp.data.get('data', {})

    def test_access_cookie_authenticates_request(self, user):
        login_resp = self.client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        access_token = login_resp.cookies['access_token'].value

        client2 = APIClient()
        client2.cookies['access_token'] = access_token
        resp = client2.get('/api/auth/profile/')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['data']['username'] == 'testuser'

    def test_refresh_via_cookie(self, user):
        login_resp = self.client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        refresh_token = login_resp.cookies['refresh_token'].value

        client2 = APIClient()
        client2.cookies['refresh_token'] = refresh_token
        resp = client2.post('/api/auth/refresh/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'access_token' in resp.cookies

    def test_logout_clears_both_cookies(self, user):
        login_resp = self.client.post(
            '/api/auth/login/',
            {'username': 'testuser', 'password': 'testpass123!'},
            format='json',
        )
        access_token = login_resp.cookies['access_token'].value
        refresh_token = login_resp.cookies['refresh_token'].value

        client2 = APIClient()
        client2.cookies['access_token'] = access_token
        client2.cookies['refresh_token'] = refresh_token
        client2.force_authenticate(user=user)
        resp = client2.post('/api/auth/logout/')
        assert resp.status_code == status.HTTP_200_OK
        assert 'access_token' in resp.cookies
        assert 'refresh_token' in resp.cookies
