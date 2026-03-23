import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { User, LoginData, RegisterData } from '../types';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = (): AuthContextType => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const refreshProfile = useCallback(async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.data.success && response.data.data) {
        const userData: User = {
          id: 0,
          username: response.data.data.username,
          email: response.data.data.email,
          first_name: response.data.data.first_name,
          last_name: response.data.data.last_name,
          date_joined: response.data.data.created_at,
          profile: response.data.data,
        };

        setState(prev => ({
          ...prev,
          user: userData,
          isAuthenticated: true,
          error: null,
        }));
      }
    } catch (error) {
      // Silently handle — this is expected when not authenticated
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
      }));
    }
  }, []);

  const login = useCallback(async (data: LoginData): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Both access and refresh tokens are set as httpOnly cookies by backend
      await authAPI.login(data);
      await refreshProfile();

      setState(prev => ({ ...prev, isLoading: false }));
      toast.success('Successfully logged in!');
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Login failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      toast.error(errorMessage);
      return false;
    }
  }, [refreshProfile]);

  const register = useCallback(async (data: RegisterData): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await authAPI.register(data);

      if (response.data.success && response.data.data) {
        const { user } = response.data.data;

        setState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }));

        toast.success('Successfully registered!');
        return true;
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      toast.error(errorMessage);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Refresh token cookie is sent automatically
      await authAPI.logout('');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      toast.success('Successfully logged out!');
    }
  }, []);

  // Check authentication status on mount.
  // If httpOnly cookies are present and valid, profile fetch succeeds.
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        await refreshProfile();
      } catch {
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          user: null,
        }));
      }

      setState(prev => ({ ...prev, isLoading: false }));
    };

    checkAuthStatus();
  }, [refreshProfile]);

  return {
    ...state,
    login,
    register,
    logout,
    refreshProfile,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
