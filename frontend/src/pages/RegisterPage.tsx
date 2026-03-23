import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
  });
  const { register, isLoading, error } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register(formData);
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
            Create account
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={handleChange}
                    className="input-primary"
                    placeholder="First name"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={handleChange}
                    className="input-primary"
                    placeholder="Last name"
                    disabled={isLoading}
                  />
                </div>
              </div>

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
                  placeholder="Choose a username"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-primary"
                  placeholder="your@email.com"
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
                  placeholder="Create a strong password"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password_confirm" className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <input
                  id="password_confirm"
                  name="password_confirm"
                  type="password"
                  required
                  value={formData.password_confirm}
                  onChange={handleChange}
                  className="input-primary"
                  placeholder="Confirm your password"
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
                  'Create Account'
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-on-surface-variant">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-on-surface-variant/50">
                By creating an account, you agree to our{' '}
                <a href="#" className="hover:text-primary transition-colors">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="hover:text-primary transition-colors">
                  Privacy Policy
                </a>.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
