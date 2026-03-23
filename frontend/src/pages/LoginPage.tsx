import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const { login, isLoading, error } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-editorial text-6xl font-light text-on-surface tracking-tight">Clio</h1>
          <p className="mt-3 text-xs text-on-surface-variant uppercase tracking-widest">
            Voice Intelligence Archive
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container rounded-lg p-8 space-y-6">
          <h2 className="font-editorial text-2xl font-light text-on-surface text-center">
            Sign in
          </h2>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-error-container/20 rounded-md p-4">
                <div className="text-sm text-error">
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="input-primary"
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input-primary"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-6 text-sm font-medium rounded-full text-surface bg-gradient-to-r from-primary to-primary-container hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-record-glow"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-on-surface-variant">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  Create one
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Features */}
        <div className="card p-6">
          <h3 className="font-editorial text-lg font-light text-on-surface mb-4">
            Why Clio?
          </h3>
          <ul className="space-y-2 text-sm text-on-surface-variant">
            <li>AI-powered speech-to-text transcription</li>
            <li>Real-time recording with visual feedback</li>
            <li>Organize notes with tags and favorites</li>
            <li>Search through transcribed content</li>
            <li>Secure cloud storage for all your recordings</li>
          </ul>
        </div>

        <div className="text-center">
          <p className="text-xs text-on-surface-variant/50">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
