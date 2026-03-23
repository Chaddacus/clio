import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Record', href: '/record', icon: MicrophoneIcon },
    { name: 'Profile', href: '/profile', icon: UserIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-surface/75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-surface-container-low transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:inset-0 transition-transform duration-300 ease-in-out flex flex-col`}>

        {/* Sidebar header */}
        <div className="flex items-center justify-between h-16 px-6 flex-shrink-0">
          <h1 className="font-editorial text-2xl font-light text-on-surface tracking-wide">Clio</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-8 px-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 py-3 text-sm font-sans font-medium rounded-lg transition-colors ${
                    active
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="flex-shrink-0 p-4 bg-surface-container-lowest">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-surface" />
              </div>
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-medium text-on-surface truncate">
                {user?.username}
              </p>
              <p className="text-xs text-on-surface-variant truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-on-surface-variant rounded-lg hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Top header for mobile */}
        <header className="lg:hidden bg-surface-container-low">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <h1 className="font-editorial text-xl font-light text-on-surface">Clio</h1>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-surface">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
