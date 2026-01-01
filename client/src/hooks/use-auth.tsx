import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  register: (data: { username: string; password: string; name?: string; email?: string }) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (data: { name?: string; email?: string; username?: string }) => Promise<{ success: boolean; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const user = data?.authenticated ? data.user : null;
  const isAuthenticated = !!user;

  const login = async (username: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const result = await res.json();
      if (result.success) {
        await refetch();
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message || "Error de conexión" };
    }
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.setQueryData(["auth"], { authenticated: false });
  };

  const register = async (data: { username: string; password: string; name?: string; email?: string }) => {
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const result = await res.json();
      if (result.success) {
        await refetch();
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message || "Error de conexión" };
    }
  };

  const updateProfile = async (data: { name?: string; email?: string; username?: string }) => {
    try {
      const res = await apiRequest("PUT", "/api/auth/profile", data);
      const result = await res.json();
      if (result.success) {
        await refetch();
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message || "Error de conexión" };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await apiRequest("PUT", "/api/auth/password", { currentPassword, newPassword });
      return await res.json();
    } catch (error: any) {
      return { success: false, message: error.message || "Error de conexión" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, logout, register, updateProfile, changePassword, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
