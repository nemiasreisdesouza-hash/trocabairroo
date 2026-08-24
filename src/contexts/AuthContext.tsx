"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import * as backend from "@/lib/backend";
import type { AuthUser } from "@/lib/types";
import type { RegisterInput } from "@/lib/backend";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  demoMode: boolean;
  login: (email: string, senha: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  register: (data: RegisterInput) => Promise<backend.RegisterResult>;
  refreshUser: () => Promise<void>;
  /**
   * CORREÇÃO DO BUG DO AVATAR: atualiza o usuário em memória
   * imediatamente (Header/Menu sincronizam na hora) e mantém
   * o perfil persistido em sincronia.
   */
  applyUserUpdate: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const PROFILE_UPDATED_EVENT = "trocabairro:profile-updated";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await backend.getCurrentUser();
      setUser(current ? { ...current } : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    backend
      .getCurrentUser()
      .then((current) => {
        if (!active) return;
        setUser(current ? { ...current } : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Sincroniza Header/Menu quando o perfil muda em outra página
    // (ex.: troca de foto de perfil no /perfil/editar)
    const onProfileUpdated = () => {
      refreshUser();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    };
  }, [refreshUser]);

  const login = async (email: string, senha: string): Promise<AuthUser> => {
    const logged = await backend.login(email, senha);
    setUser({ ...logged });
    return logged;
  };

  const logout = async () => {
    await backend.logout();
    setUser(null);
    window.location.href = "/";
  };

  const register = async (data: RegisterInput) => {
    const result = await backend.register(data);
    if (result.user) setUser({ ...result.user });
    return result;
  };

  const applyUserUpdate = (updated: AuthUser) => {
    setUser({ ...updated });
    // Garante que outros componentes (Header, BottomNav) também
    // se atualizem mesmo estando em outra árvore de componentes:
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        demoMode: backend.appMode() === "demo",
        login,
        logout,
        register,
        refreshUser,
        applyUserUpdate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
