import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userType: 'admin' | 'client' | null;
  login: (token: string, type: 'admin' | 'client') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Inicialização SÍNCRONA — não precisa de useEffect nem loading
  const [isAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('access_token')
  );
  const [userType] = useState<'admin' | 'client' | null>(
    () => localStorage.getItem('user_type') as 'admin' | 'client' | null
  );

  const login = (token: string, type: 'admin' | 'client') => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_type', type);
    // Forçar navegação direta sem depender de re-render
    window.location.href = type === 'admin' ? '/admin/dashboard' : '/dashboard';
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_type');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userType, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
