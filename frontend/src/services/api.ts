import axios, { AxiosError } from 'axios';

// Configuração base da API
const API_BASE_URL = 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tipos para respostas da API
export interface ApiResponse<T = any> {
  message?: string;
  error?: string;
  data?: T;
}

export interface WorkspaceInfo {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  hasData: boolean;
}

export interface SessionInfo {
  workspace: WorkspaceInfo;
  session: {
    unlocked: boolean;
    lastActivity: string;
    sessionId: string;
  };
}

export interface AuthStatus {
  hasWorkspace: boolean;
  needsSetup: boolean;
  serverTime: string;
}

// Token management
const TOKEN_KEY = 'acesso_clientes_token';

export const tokenManager = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  hasToken(): boolean {
    return !!this.getToken();
  }
};

// Request interceptor para adicionar token
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor para tratar erros e tokens expirados
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token inválido ou expirado
      tokenManager.removeToken();
      
      // Redirecionar para login se não estiver já na página de login
      if (window.location.pathname !== '/login' && window.location.pathname !== '/setup') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  // Verificar status do sistema
  async getStatus(): Promise<AuthStatus> {
    const response = await api.get('/auth/status');
    return response.data;
  },

  // Criar workspace (primeiro uso)
  async createWorkspace(data: { name: string; password: string }): Promise<{
    workspace: WorkspaceInfo;
    token: string;
  }> {
    const response = await api.post('/auth/setup', data);
    
    if (response.data.token) {
      tokenManager.setToken(response.data.token);
    }
    
    return response.data;
  },

  // Login inicial
  async login(data: { password: string }): Promise<{
    workspace: WorkspaceInfo;
    token: string;
    unlocked: boolean;
  }> {
    const response = await api.post('/auth/login', data);
    
    if (response.data.token) {
      tokenManager.setToken(response.data.token);
    }
    
    return response.data;
  },

  // Unlock workspace (Gate 1)
  async unlockWorkspace(data: { password: string }): Promise<{
    unlocked: boolean;
  }> {
    const response = await api.post('/auth/unlock', data);
    return response.data;
  },

  // Lock workspace
  async lockWorkspace(): Promise<void> {
    await api.post('/auth/lock');
  },

  // Logout
  async logout(): Promise<void> {
    await api.post('/auth/logout');
    tokenManager.removeToken();
  },

  // Validar acesso a cliente (Gate 2)
  async validateClientAccess(clientId: number, password: string): Promise<{
    accessGranted: boolean;
    validUntil: string;
  }> {
    const response = await api.post(`/auth/validate-client/${clientId}`, { password });
    return response.data;
  },

  // Alterar senha
  async changePassword(data: { 
    currentPassword: string; 
    newPassword: string; 
  }): Promise<void> {
    await api.post('/auth/change-password', data);
  },

  // Obter informações da sessão
  async getSessionInfo(): Promise<SessionInfo> {
    const response = await api.get('/auth/session');
    return response.data;
  }
};

// Clients API (será implementado na Fase 4)
export const clientsApi = {
  async getClients(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await api.get('/clients', { params });
    return response.data;
  },

  async getClient(id: number) {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  async createClient(data: { name: string; notes?: string }) {
    const response = await api.post('/clients', data);
    return response.data;
  },

  async updateClient(id: number, data: { name?: string; notes?: string }) {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  async deleteClient(id: number) {
    await api.delete(`/clients/${id}`);
  }
};

// Error handling utilities
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'Erro desconhecido';
};

// Validation utilities
export const validatePassword = (password: string): {
  isValid: boolean;
  suggestions: string[];
} => {
  const suggestions: string[] = [];
  
  if (password.length < 8) {
    suggestions.push('Use pelo menos 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    suggestions.push('Inclua pelo menos uma letra maiúscula');
  }
  
  if (!/[a-z]/.test(password)) {
    suggestions.push('Inclua pelo menos uma letra minúscula');
  }
  
  if (!/\d/.test(password)) {
    suggestions.push('Inclua pelo menos um número');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
    suggestions.push('Inclua pelo menos um caractere especial');
  }
  
  return {
    isValid: password.length >= 8 && suggestions.length <= 1,
    suggestions
  };
};

export default api;