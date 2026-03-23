import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { authAPI } from '../services/api';
import { UserProfile } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import toast from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});

  const { data: profileData, isLoading, refetch } = useQuery(
    ['user-profile'],
    () => authAPI.getProfile(),
    {
      onSuccess: (response) => {
        if (response.data.success && response.data.data) {
          setFormData(response.data.data);
        }
      },
      onError: () => {
        toast.error('Failed to load profile');
      },
    }
  );

  const updateProfileMutation = useMutation(
    (data: Partial<UserProfile>) => authAPI.updateProfile(data),
    {
      onSuccess: () => {
        toast.success('Profile updated successfully');
        setIsEditing(false);
        refetch();
      },
      onError: () => {
        toast.error('Failed to update profile');
      },
    }
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (profileData?.data.success && profileData.data.data) {
      setFormData(profileData.data.data);
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  const profile = profileData?.data.data;

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="font-editorial text-2xl font-light text-on-surface mb-2">
          Profile not found
        </h2>
        <p className="text-on-surface-variant text-sm">
          Unable to load your profile information.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-editorial text-4xl font-light text-on-surface">Profile</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage your account preferences</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary"
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Information */}
      <div className="card p-6 space-y-6">
        <h2 className="font-editorial text-xl font-light text-on-surface">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              First Name
            </label>
            {isEditing ? (
              <input
                type="text"
                name="first_name"
                value={formData.first_name || ''}
                onChange={handleInputChange}
                className="input-primary"
                disabled={updateProfileMutation.isLoading}
              />
            ) : (
              <p className="text-on-surface">{profile.first_name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Last Name
            </label>
            {isEditing ? (
              <input
                type="text"
                name="last_name"
                value={formData.last_name || ''}
                onChange={handleInputChange}
                className="input-primary"
                disabled={updateProfileMutation.isLoading}
              />
            ) : (
              <p className="text-on-surface">{profile.last_name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Username
            </label>
            <p className="text-on-surface">{profile.username}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">Username cannot be changed</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Email
            </label>
            <p className="text-on-surface">{profile.email}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">Email cannot be changed</p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="card p-6 space-y-6">
        <h2 className="font-editorial text-xl font-light text-on-surface">
          Recording Preferences
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Preferred Language
            </label>
            {isEditing ? (
              <select
                name="preferred_language"
                value={formData.preferred_language || ''}
                onChange={handleInputChange}
                className="input-primary"
                disabled={updateProfileMutation.isLoading}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (GB)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-PT">Portuguese</option>
                <option value="ja-JP">Japanese</option>
                <option value="ko-KR">Korean</option>
                <option value="zh-CN">Chinese (Simplified)</option>
              </select>
            ) : (
              <p className="text-on-surface">{profile.preferred_language}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
              Audio Quality
            </label>
            {isEditing ? (
              <select
                name="audio_quality"
                value={formData.audio_quality || ''}
                onChange={handleInputChange}
                className="input-primary"
                disabled={updateProfileMutation.isLoading}
              >
                <option value="high">High (44.1kHz)</option>
                <option value="medium">Medium (16kHz)</option>
                <option value="low">Low (8kHz)</option>
              </select>
            ) : (
              <p className="text-on-surface">
                {profile.audio_quality === 'high' && 'High (44.1kHz)'}
                {profile.audio_quality === 'medium' && 'Medium (16kHz)'}
                {profile.audio_quality === 'low' && 'Low (8kHz)'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Storage Usage */}
      <div className="card p-6 space-y-4">
        <h2 className="font-editorial text-xl font-light text-on-surface">
          Storage Usage
        </h2>

        <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider mb-2">
          <span>Used Storage</span>
          <span>
            {profile.storage_used_mb.toFixed(1)} MB / {profile.storage_quota_mb} MB
          </span>
        </div>

        <div className="w-full bg-surface-container-lowest rounded-full h-2">
          <div
            className="bg-gradient-to-r from-primary to-primary-container h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(profile.storage_percentage, 100)}%` }}
          />
        </div>

        <div className="text-xs text-on-surface-variant uppercase tracking-wider">
          {profile.storage_percentage.toFixed(1)}% of your storage quota is being used
        </div>
      </div>

      {/* Action Buttons */}
      {isEditing && (
        <div className="flex space-x-3">
          <button
            onClick={handleSave}
            disabled={updateProfileMutation.isLoading}
            className="btn-primary flex-1 justify-center"
          >
            {updateProfileMutation.isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>

          <button
            onClick={handleCancel}
            disabled={updateProfileMutation.isLoading}
            className="btn-secondary flex-1 justify-center"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Account Info */}
      <div className="card p-6">
        <h2 className="font-editorial text-xl font-light text-on-surface mb-4">
          Account Information
        </h2>
        <div className="text-xs text-on-surface-variant uppercase tracking-wider">
          <p>Account created: {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
