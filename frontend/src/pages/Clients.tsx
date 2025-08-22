import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import RichTextEditor from '../components/ui/RichTextEditor';

interface Client {
  id: number;
  name: string;
  hasNotes: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientDetails extends Client {
  notes: string;
  images: any[];
}

interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const Clients: React.FC = () => {
  const { state } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para busca e paginação
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados para modal de criação/edição
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDetails | null>(null);
  const [modalForm, setModalForm] = useState({
    name: '',
    notes: ''
  });

  // Carregar clientes
  const loadClients = async (page = 1, searchTerm = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      
      const response = await api.get(`/clients?${params}`);
      
      if (response.data.success) {
        setClients(response.data.data.clients);
        setPagination(response.data.data.pagination);
        setCurrentPage(page);
      } else {
        setError('Erro ao carregar clientes');
      }
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      setError(error.response?.data?.error || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Carregar detalhes de um cliente para edição
  const loadClientDetails = async (clientId: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/clients/${clientId}`);
      
      if (response.data.success) {
        const client = response.data.data.client;
        setEditingClient(client);
        setModalForm({
          name: client.name,
          notes: client.notes || ''
        });
        setShowModal(true);
      } else {
        setError('Erro ao carregar detalhes do cliente');
      }
    } catch (error: any) {
      console.error('Erro ao carregar cliente:', error);
      setError(error.response?.data?.error || 'Erro ao carregar cliente');
    } finally {
      setLoading(false);
    }
  };

  // Criar ou atualizar cliente
  const saveClient = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!modalForm.name.trim()) {
        setError('Nome do cliente é obrigatório');
        return;
      }
      
      const clientData = {
        name: modalForm.name.trim(),
        notes: modalForm.notes.trim() || undefined
      };
      
      let response;
      if (editingClient) {
        response = await api.put(`/clients/${editingClient.id}`, clientData);
      } else {
        response = await api.post('/clients', clientData);
      }
      
      if (response.data.success) {
        setSuccess(editingClient ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!');
        setShowModal(false);
        setEditingClient(null);
        setModalForm({ name: '', notes: '' });
        await loadClients(currentPage, search);
      } else {
        setError(response.data.error || 'Erro ao salvar cliente');
      }
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      setError(error.response?.data?.error || 'Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  // Deletar cliente
  const deleteClient = async (clientId: number, clientName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o cliente "${clientName}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.delete(`/clients/${clientId}`);
      
      if (response.data.success) {
        setSuccess('Cliente deletado com sucesso!');
        await loadClients(currentPage, search);
      } else {
        setError('Erro ao deletar cliente');
      }
    } catch (error: any) {
      console.error('Erro ao deletar cliente:', error);
      setError(error.response?.data?.error || 'Erro ao deletar cliente');
    } finally {
      setLoading(false);
    }
  };

  // Buscar
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadClients(1, search);
  };

  // Efeitos
  useEffect(() => {
    if (state.isAuthenticated) {
      loadClients();
    }
  }, [state.isAuthenticated]);

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (!state.isAuthenticated) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Button
          onClick={() => {
            setEditingClient(null);
            setModalForm({ name: '', notes: '' });
            setShowModal(true);
          }}
        >
          Novo Cliente
        </Button>
      </div>

      {/* Busca */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Buscar</Button>
        </div>
      </form>

      {/* Alertas */}
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Lista de clientes */}
      {!loading && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anotações
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{client.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      client.hasNotes 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {client.hasNotes ? 'Com anotações' : 'Sem anotações'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(client.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => loadClientDetails(client.id)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteClient(client.id, client.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {clients.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {search ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado.'}
            </div>
          )}
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => loadClients(currentPage - 1, search)}
              disabled={currentPage <= 1}
            >
              Anterior
            </Button>
            <span className="px-4 py-2 text-sm text-gray-700">
              Página {pagination.current_page} de {pagination.total_pages}
            </span>
            <Button
              variant="secondary"
              onClick={() => loadClients(currentPage + 1, search)}
              disabled={currentPage >= pagination.total_pages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Cliente
                  </label>
                  <Input
                    type="text"
                    value={modalForm.name}
                    onChange={(e) => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Digite o nome do cliente..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Anotações
                  </label>
                  <RichTextEditor
                    value={modalForm.notes}
                    onChange={(content) => setModalForm(prev => ({ ...prev, notes: content }))}
                    placeholder="Digite as anotações do cliente..."
                    height={400}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setEditingClient(null);
                    setModalForm({ name: '', notes: '' });
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={saveClient} disabled={loading}>
                  {loading ? 'Salvando...' : (editingClient ? 'Atualizar' : 'Criar')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;