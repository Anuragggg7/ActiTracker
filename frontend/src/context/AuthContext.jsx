import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      const token = localStorage.getItem('rcpit_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          localStorage.removeItem('rcpit_token');
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        localStorage.removeItem('rcpit_token');
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { email: identifier, password });
    if (res.success) {
      const token = res.token || res.data?.token;
      const userObj = res.user || res.data?.user;
      localStorage.setItem('rcpit_token', token);
      setUser(userObj);
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Logout notification error:', err.message);
    } finally {
      localStorage.removeItem('rcpit_token');
      setUser(null);
    }
  };

  const refreshSession = async () => {
    try {
      const res = await api.post('/auth/refresh');
      if (res.success && res.token) {
        localStorage.setItem('rcpit_token', res.token);
        if (res.user) setUser(res.user);
      }
    } catch (err) {
      console.error('Session refresh failed:', err.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
