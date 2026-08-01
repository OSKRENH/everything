import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth.api.js';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    async function restore() {
      if (getToken()) {
        try {
          const current = await authApi.me();
          setUser(current);
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    }
    restore();
  }, []);

  async function login(email, password) {
    const { token, user: loggedInUser } = await authApi.login(email, password);
    setToken(token);
    setUser(loggedInUser);
  }

  async function register(email, password) {
    const { token, user: newUser } = await authApi.register(email, password);
    setToken(token);
    setUser(newUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
