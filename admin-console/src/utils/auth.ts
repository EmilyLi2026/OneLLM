import { useState, useCallback } from 'react';

const TOKEN_KEY = 'aihub_token';
const USER_KEY = 'aihub_user';
const WS_KEY = 'aihub_workspace';

interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  role: string;
}

export function useAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  const login = useCallback((token: string, user: User, workspace?: WorkspaceInfo | null) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (workspace) {
      localStorage.setItem(WS_KEY, JSON.stringify(workspace));
    }
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WS_KEY);
    setIsAuthenticated(false);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  const getUser = useCallback((): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }, []);

  const getWorkspace = useCallback((): WorkspaceInfo | null => {
    const raw = localStorage.getItem(WS_KEY);
    return raw ? JSON.parse(raw) : null;
  }, []);

  return { isAuthenticated, login, logout, getToken, getUser, getWorkspace };
}
