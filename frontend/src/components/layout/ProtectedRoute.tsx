import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import WorkspaceUnlock from '../auth/WorkspaceUnlock';

interface ProtectedRouteProps {
  children: ReactNode;
  requireUnlocked?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireUnlocked = false 
}) => {
  const { state } = useAuth();
  const location = useLocation();

  // Aguardar inicialização
  if (!state.isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-2 text-sm text-secondary-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não está autenticado, redirecionar para login
  if (!state.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se requer desbloqueio e não está desbloqueado, mostrar tela de unlock
  if (requireUnlocked && !state.isUnlocked) {
    return <WorkspaceUnlock />;
  }

  // Se chegou até aqui, pode mostrar o conteúdo
  return <>{children}</>;
};

export default ProtectedRoute;