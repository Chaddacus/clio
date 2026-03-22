import pytest
from apps.users.serializers import UserProfileSerializer


@pytest.mark.django_db
class TestUserProfileSerializer:
    def test_storage_quota_is_readonly(self):
        assert 'storage_quota_mb' in UserProfileSerializer.Meta.read_only_fields

    def test_storage_used_is_readonly(self):
        assert 'storage_used_mb' in UserProfileSerializer.Meta.read_only_fields
