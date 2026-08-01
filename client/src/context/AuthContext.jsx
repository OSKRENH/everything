import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth.api.js';
import * as backendInventory from '../api/inventory.api.js';
import * as guestInventory from '../api/guestInventory.js';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

async function migrateGuestInventory() {
  if (!guestInventory.hasGuestData()) return;
  const { ingredients, equipment } = await guestInventory.listInventory();
  for (const item of [...ingredients, ...equipment]) {
    try {
      await backendInventory.addItem(item.type, item.name);
    } catch {
      // duplicate or invalid — skip, not fatal to login/registration
    }
  }
  guestInventory.clearGuestData();
}

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
    await migrateGuestInventory();
    setUser(loggedInUser);
  }

  async function register(email, password) {
    const { token, user: newUser } = await authApi.register(email, password);
    setToken(token);
    await migrateGuestInventory();
    setUser(newUser);
  }

  async function loginWithGoogle(credential) {
    const { token, user: loggedInUser } = await authApi.googleLogin(credential);
    setToken(token);
    await migrateGuestInventory();
    setUser(loggedInUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
