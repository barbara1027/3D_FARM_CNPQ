import React, { createContext, useContext, useState } from 'react';

type UserType  = 'admin' | 'client' | null;
type UserNivel = 'iniciante' | 'avancado' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  userType: UserType;
  nivel: UserNivel;
  login: (token: string, type: 'admin' | 'client', nivel?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('access_token')
  );
  const [userType] = useState<UserType>(
    () => localStorage.getItem('user_type') as UserType
  );
  const [nivel] = useState<UserNivel>(
    () => localStorage.getItem('user_nivel') as UserNivel
  );

  const login = (token: string, type: 'admin' | 'client', nivelParam?: string) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_type', type);
    const nivelSalvo: UserNivel = nivelParam === 'avancado' ? 'avancado' : 'iniciante';
    localStorage.setItem('user_nivel', nivelSalvo);
    window.location.href = type === 'admin' ? '/admin/dashboard' : '/dashboard';
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_nivel');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userType, nivel, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
