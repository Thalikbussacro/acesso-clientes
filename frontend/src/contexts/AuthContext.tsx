import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authApi, tokenManager, type WorkspaceInfo, type SessionInfo } from '../services/api';

// Tipos para o estado de autenticação
export interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isUnlocked: boolean;
  workspace: WorkspaceInfo | null;
  sessionInfo: SessionInfo | null;
  loading: boolean;
  error: string | null;
}

// Tipos para as ações
type AuthAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { hasWorkspace: boolean } }
  | { type: 'INIT_ERROR'; payload: string }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { workspace: WorkspaceInfo; unlocked: boolean } }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'UNLOCK_START' }
  | { type: 'UNLOCK_SUCCESS' }
  | { type: 'UNLOCK_ERROR'; payload: string }
  | { type: 'LOCK' }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_SESSION_INFO'; payload: SessionInfo };

// Estado inicial
const initialState: AuthState = {
  isInitialized: false,
  isAuthenticated: false,
  isUnlocked: false,
  workspace: null,
  sessionInfo: null,
  loading: false,
  error: null,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'INIT_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'INIT_SUCCESS':
      return {
        ...state,
        isInitialized: true,
        loading: false,
        error: null,
      };

    case 'INIT_ERROR':
      return {
        ...state,
        isInitialized: true,
        loading: false,
        error: action.payload,
      };

    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isUnlocked: action.payload.unlocked,
        workspace: action.payload.workspace,
        loading: false,
        error: null,
      };

    case 'LOGIN_ERROR':
      return {
        ...state,
        isAuthenticated: false,
        isUnlocked: false,
        workspace: null,
        loading: false,
        error: action.payload,
      };

    case 'UNLOCK_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'UNLOCK_SUCCESS':
      return {
        ...state,
        isUnlocked: true,
        loading: false,
        error: null,
      };

    case 'UNLOCK_ERROR':
      return {
        ...state,
        isUnlocked: false,
        loading: false,
        error: action.payload,
      };

    case 'LOCK':
      return {
        ...state,
        isUnlocked: false,
      };

    case 'LOGOUT':
      return {
        ...initialState,
        isInitialized: true,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_SESSION_INFO':
      return {
        ...state,
        sessionInfo: action.payload,
        isUnlocked: action.payload.session.unlocked,
        workspace: action.payload.workspace,
      };

    default:
      return state;
  }
};

// Context
interface AuthContextType {
  state: AuthState;
  setupWorkspace: (name: string, password: string) => Promise<void>;
  login: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
  logout: () => Promise<void>;
  validateClientAccess: (clientId: number, password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Inicialização
  useEffect(() => {
    const initialize = async () => {
      dispatch({ type: 'INIT_START' });

      try {
        // Verificar status do sistema
        const status = await authApi.getStatus();
        
        // Se tem token, tentar obter informações da sessão
        if (tokenManager.hasToken() && status.hasWorkspace) {
          try {
            const sessionInfo = await authApi.getSessionInfo();
            dispatch({ type: 'SET_SESSION_INFO', payload: sessionInfo });
            dispatch({ type: 'LOGIN_SUCCESS', payload: { 
              workspace: sessionInfo.workspace, 
              unlocked: sessionInfo.session.unlocked 
            }});
          } catch (error) {
            // Token inválido, remover
            tokenManager.removeToken();
          }
        }

        dispatch({ type: 'INIT_SUCCESS', payload: { hasWorkspace: status.hasWorkspace } });
      } catch (error) {
        dispatch({ type: 'INIT_ERROR', payload: 'Erro ao inicializar aplicação' });
      }
    };

    initialize();
  }, []);

  // Métodos do contexto
  const setupWorkspace = async (name: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const result = await authApi.createWorkspace({ name, password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: { 
        workspace: result.workspace, 
        unlocked: false // Workspace criado mas ainda bloqueado
      }});
    } catch (error: any) {
      dispatch({ type: 'LOGIN_ERROR', payload: error.response?.data?.message || 'Erro ao criar workspace' });
      throw error;
    }
  };

  const login = async (password: string) => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const result = await authApi.login({ password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: { 
        workspace: result.workspace, 
        unlocked: result.unlocked 
      }});
    } catch (error: any) {
      dispatch({ type: 'LOGIN_ERROR', payload: error.response?.data?.message || 'Erro no login' });
      throw error;
    }
  };

  const unlock = async (password: string) => {
    dispatch({ type: 'UNLOCK_START' });
    
    try {
      await authApi.unlockWorkspace({ password });
      dispatch({ type: 'UNLOCK_SUCCESS' });
    } catch (error: any) {
      dispatch({ type: 'UNLOCK_ERROR', payload: error.response?.data?.message || 'Erro ao desbloquear' });
      throw error;
    }
  };

  const lock = async () => {
    try {
      await authApi.lockWorkspace();
      dispatch({ type: 'LOCK' });
    } catch (error) {
      // Mesmo que falhe no servidor, bloquear localmente
      dispatch({ type: 'LOCK' });
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Mesmo que falhe no servidor, fazer logout local
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const validateClientAccess = async (clientId: number, password: string): Promise<boolean> => {
    try {
      const result = await authApi.validateClientAccess(clientId, password);
      return result.accessGranted;
    } catch (error) {
      return false;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await authApi.changePassword({ currentPassword, newPassword });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao alterar senha');
    }
  };

  const refreshSession = async () => {
    try {
      const sessionInfo = await authApi.getSessionInfo();
      dispatch({ type: 'SET_SESSION_INFO', payload: sessionInfo });
    } catch (error) {
      // Se falhar, fazer logout
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const contextValue: AuthContextType = {
    state,
    setupWorkspace,
    login,
    unlock,
    lock,
    logout,
    validateClientAccess,
    changePassword,
    refreshSession,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export default AuthContext;