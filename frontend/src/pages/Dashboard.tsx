import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';

const Dashboard: React.FC = () => {
  const { state, validateClientAccess } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [clientPassword, setClientPassword] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dados mockados para demonstração (será substituído pela API na Fase 4)
  const mockClients = [
    { id: 1, name: 'Empresa ABC Ltda', hasNotes: true, lastAccessed: '2025-01-15' },
    { id: 2, name: 'Cliente XYZ Corp', hasNotes: false, lastAccessed: '2025-01-10' },
    { id: 3, name: 'Organização 123', hasNotes: true, lastAccessed: '2025-01-08' },
  ];

  const filteredClients = mockClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClientAccess = async (clientId: number) => {
    setSelectedClient(clientId);
    setShowClientModal(true);
    setError('');
    setClientPassword('');
  };

  const handleValidateAccess = async () => {
    if (!selectedClient || !clientPassword.trim()) {
      setError('Senha é obrigatória');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isValid = await validateClientAccess(selectedClient, clientPassword);
      
      if (isValid) {
        // Acesso concedido - implementar navegação para cliente na Fase 4
        setShowClientModal(false);
        setClientPassword('');
        alert(`Acesso concedido ao cliente ${selectedClient}!\n\n(Tela do cliente será implementada na Fase 4)`);
      } else {
        setError('Senha inválida');
      }
    } catch (error) {
      setError('Erro ao validar acesso');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowClientModal(false);
    setSelectedClient(null);
    setClientPassword('');
    setError('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
        <p className="mt-1 text-sm text-secondary-600">
          Gerencie os acessos remotos dos seus clientes
        </p>
      </div>

      {/* Status do workspace */}
      <div className="mb-6">
        <Alert type={state.isUnlocked ? 'success' : 'warning'}>
          <strong>Status do Workspace:</strong> {state.isUnlocked ? 'Desbloqueado' : 'Bloqueado'}
          {!state.isUnlocked && (
            <span> - Desbloqueie o workspace para acessar os clientes</span>
          )}
        </Alert>
      </div>

      {/* Seção de pesquisa */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Pesquisar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
          <Button disabled>
            Novo Cliente (Fase 4)
          </Button>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="bg-white shadow-sm rounded-lg border border-secondary-200">
        <div className="px-6 py-4 border-b border-secondary-200">
          <h2 className="text-lg font-medium text-secondary-900">
            Clientes ({filteredClients.length})
          </h2>
        </div>

        {filteredClients.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-secondary-900">Nenhum cliente encontrado</h3>
            <p className="mt-1 text-sm text-secondary-500">
              {searchTerm ? 'Tente uma pesquisa diferente' : 'Adicione seu primeiro cliente para começar'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-200">
            {filteredClients.map((client) => (
              <div key={client.id} className="px-6 py-4 hover:bg-secondary-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-secondary-900">
                      {client.name}
                    </h3>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-secondary-500">
                      <span>Último acesso: {client.lastAccessed}</span>
                      {client.hasNotes && (
                        <span className="flex items-center">
                          <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Com notas
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!state.isUnlocked}
                      onClick={() => handleClientAccess(client.id)}
                    >
                      Acessar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de validação de acesso ao cliente (Gate 2) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-secondary-200">
              <h3 className="text-lg font-medium text-secondary-900">
                Validação de Acesso (Gate 2)
              </h3>
              <p className="mt-1 text-sm text-secondary-600">
                Digite sua senha master para acessar este cliente
              </p>
            </div>

            <div className="px-6 py-4">
              {error && (
                <Alert type="error" className="mb-4">
                  {error}
                </Alert>
              )}

              <Alert type="info" className="mb-4">
                <strong>Dupla Segurança:</strong> Esta é a segunda verificação de senha para acessar dados específicos do cliente.
              </Alert>

              <Input
                label="Senha Master"
                type="password"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                placeholder="Digite sua senha master"
                autoFocus
                leftIcon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m6 0V7a2 2 0 00-2-2H9a2 2 0 00-2 2v2m6 0H9" />
                  </svg>
                }
              />
            </div>

            <div className="px-6 py-4 bg-secondary-50 flex space-x-3">
              <Button
                onClick={handleValidateAccess}
                loading={loading}
                disabled={!clientPassword.trim()}
                className="flex-1"
              >
                Validar e Acessar
              </Button>
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;