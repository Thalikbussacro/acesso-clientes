import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';

const WorkspaceUnlock: React.FC = () => {
  const { unlock, lock, logout, state } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      return;
    }

    try {
      await unlock(password);
      setPassword(''); // Limpar senha após sucesso
    } catch (error) {
      // Erro já tratado no contexto
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (state.isUnlocked) {
    return null; // Componente não deve ser exibido se já desbloqueado
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-secondary-900">
            Workspace Bloqueado
          </h2>
          <p className="mt-2 text-sm text-secondary-600">
            Digite sua senha master para desbloquear o workspace
          </p>
          {state.workspace && (
            <p className="mt-1 text-xs text-secondary-500">
              {state.workspace.name}
            </p>
          )}
        </div>

        <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
          {state.error && (
            <Alert type="error" className="mb-6">
              {state.error}
            </Alert>
          )}

          <Alert type="info" className="mb-6">
            <strong>Gate 1 de Segurança:</strong> Esta é a primeira verificação de senha. 
            Você precisará validar novamente ao acessar cada cliente individual.
          </Alert>

          <form className="space-y-6" onSubmit={handleUnlock}>
            <Input
              label="Senha Master"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha master"
              required
              autoFocus
              leftIcon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m6 0V7a2 2 0 00-2-2H9a2 2 0 00-2 2v2m6 0H9" />
                </svg>
              }
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-secondary-400 hover:text-secondary-600"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              }
            />

            <div className="flex space-x-3">
              <Button
                type="submit"
                className="flex-1"
                loading={state.loading}
                disabled={!password.trim()}
              >
                Desbloquear
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                disabled={state.loading}
              >
                Sair
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-secondary-50 rounded-lg">
            <h3 className="text-sm font-medium text-secondary-900 mb-2">
              Sistema de Duplo Gate
            </h3>
            <div className="text-xs text-secondary-600 space-y-1">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                <span>Gate 1: Desbloquear workspace (atual)</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-secondary-300 rounded-full mr-2"></div>
                <span>Gate 2: Validar acesso a cada cliente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceUnlock;