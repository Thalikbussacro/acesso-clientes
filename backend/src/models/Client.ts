import { databaseService } from '../services/DatabaseService';
import CryptoService, { EncryptedData } from '../services/CryptoService';
import Workspace from './Workspace';

export interface ClientData {
  id?: number;
  workspace_id: number;
  name: string;
  notes_content?: string; // Rich text criptografado
  notes_images?: string; // JSON criptografado com metadata das imagens
  search_index?: string; // Índice de busca não criptografado
  created_at?: string;
  updated_at?: string;
}

export interface ImageMetadata {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  uploaded_at: string;
}

export interface CreateClientRequest {
  name: string;
  notes?: string;
  images?: ImageMetadata[];
}

export interface UpdateClientRequest {
  name?: string;
  notes?: string;
  images?: ImageMetadata[];
}

export interface ClientInfo {
  id: number;
  name: string;
  hasNotes: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientDetails extends ClientInfo {
  notes: string;
  images: ImageMetadata[];
}

export class Client {
  private data: ClientData;
  private workspace: Workspace;

  constructor(data: ClientData, workspace: Workspace) {
    this.data = data;
    this.workspace = workspace;
  }

  // Getters
  get id(): number | undefined {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get workspaceId(): number {
    return this.data.workspace_id;
  }

  get createdAt(): string | undefined {
    return this.data.created_at;
  }

  get updatedAt(): string | undefined {
    return this.data.updated_at;
  }

  get hasNotes(): boolean {
    return Boolean(this.data.notes_content);
  }

  /**
   * Descriptografa e retorna as notas
   */
  getDecryptedNotes(): string {
    if (!this.data.notes_content) {
      return '';
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(this.data.notes_content);
      return CryptoService.decrypt(encryptedData, this.workspace.getMasterKey());
    } catch (error) {
      console.error('❌ Erro ao descriptografar notas:', error);
      throw new Error('Falha ao descriptografar notas do cliente');
    }
  }

  /**
   * Descriptografa e retorna as imagens
   */
  getDecryptedImages(): ImageMetadata[] {
    if (!this.data.notes_images) {
      return [];
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(this.data.notes_images);
      const decryptedJson = CryptoService.decrypt(encryptedData, this.workspace.getMasterKey());
      return JSON.parse(decryptedJson);
    } catch (error) {
      console.error('❌ Erro ao descriptografar imagens:', error);
      throw new Error('Falha ao descriptografar imagens do cliente');
    }
  }

  /**
   * Criptografa e define as notas
   */
  private setEncryptedNotes(notes: string): void {
    if (!notes || notes.trim() === '') {
      this.data.notes_content = undefined;
      this.data.search_index = '';
      return;
    }

    try {
      const encryptedData = CryptoService.encrypt(notes, this.workspace.getMasterKey());
      this.data.notes_content = JSON.stringify(encryptedData);
      
      // Criar índice de busca (texto limpo para permitir busca)
      this.data.search_index = this.createSearchIndex(notes);
    } catch (error) {
      console.error('❌ Erro ao criptografar notas:', error);
      throw new Error('Falha ao criptografar notas do cliente');
    }
  }

  /**
   * Criptografa e define as imagens
   */
  private setEncryptedImages(images: ImageMetadata[]): void {
    if (!images || images.length === 0) {
      this.data.notes_images = undefined;
      return;
    }

    try {
      const imagesJson = JSON.stringify(images);
      const encryptedData = CryptoService.encrypt(imagesJson, this.workspace.getMasterKey());
      this.data.notes_images = JSON.stringify(encryptedData);
    } catch (error) {
      console.error('❌ Erro ao criptografar imagens:', error);
      throw new Error('Falha ao criptografar metadados das imagens');
    }
  }

  /**
   * Cria índice de busca a partir do texto
   */
  private createSearchIndex(text: string): string {
    // Remove HTML tags, caracteres especiais e normaliza
    return text
      .replace(/<[^>]*>/g, ' ') // Remove HTML
      .replace(/[^\w\s]/g, ' ') // Remove caracteres especiais
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2) // Palavras com mais de 2 caracteres
      .join(' ');
  }

  /**
   * Atualiza dados do cliente
   */
  async update(request: UpdateClientRequest): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (request.name !== undefined) {
        updates.push('name = ?');
        params.push(request.name);
        this.data.name = request.name;
      }

      if (request.notes !== undefined) {
        this.setEncryptedNotes(request.notes);
        updates.push('notes_content = ?', 'search_index = ?');
        params.push(this.data.notes_content, this.data.search_index);
      }

      if (request.images !== undefined) {
        this.setEncryptedImages(request.images);
        updates.push('notes_images = ?');
        params.push(this.data.notes_images);
      }

      if (updates.length === 0) {
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.data.id);

      await databaseService.run(
        `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  /**
   * Deleta o cliente
   */
  async delete(): Promise<void> {
    try {
      await databaseService.run(
        'DELETE FROM clients WHERE id = ?',
        [this.data.id]
      );
    } catch (error) {
      console.error('❌ Erro ao deletar cliente:', error);
      throw error;
    }
  }

  /**
   * Converte para formato de informações básicas
   */
  toInfo(): ClientInfo {
    return {
      id: this.data.id!,
      name: this.data.name,
      hasNotes: this.hasNotes,
      created_at: this.data.created_at!,
      updated_at: this.data.updated_at!
    };
  }

  /**
   * Converte para formato com detalhes (notas descriptografadas)
   */
  toDetails(): ClientDetails {
    return {
      ...this.toInfo(),
      notes: this.getDecryptedNotes(),
      images: this.getDecryptedImages()
    };
  }

  // Métodos estáticos

  /**
   * Cria novo cliente
   */
  static async create(workspaceId: number, request: CreateClientRequest, workspace: Workspace): Promise<Client> {
    try {
      if (!workspace.hasKey) {
        throw new Error('Workspace deve estar desbloqueado para criar cliente');
      }

      const client = new Client({
        workspace_id: workspaceId,
        name: request.name
      }, workspace);

      // Definir notas se fornecidas
      if (request.notes) {
        client.setEncryptedNotes(request.notes);
      }

      // Definir imagens se fornecidas
      if (request.images) {
        client.setEncryptedImages(request.images);
      }

      // Inserir no banco
      const result = await databaseService.run(
        `INSERT INTO clients (workspace_id, name, notes_content, notes_images, search_index)
         VALUES (?, ?, ?, ?, ?)`,
        [workspaceId, request.name, client.data.notes_content, client.data.notes_images, client.data.search_index]
      );

      client.data.id = result.lastID;
      return client;
    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error);
      throw error;
    }
  }

  /**
   * Busca cliente por ID
   */
  static async findById(id: number, workspace: Workspace): Promise<Client | null> {
    try {
      const data = await databaseService.get<ClientData>(
        'SELECT * FROM clients WHERE id = ? AND workspace_id = ?',
        [id, workspace.id]
      );

      return data ? new Client(data, workspace) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar cliente:', error);
      throw error;
    }
  }

  /**
   * Lista clientes com paginação e busca
   */
  static async findAll(
    workspaceId: number, 
    workspace: Workspace,
    options: {
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ clients: Client[]; total: number }> {
    try {
      const { search, limit = 50, offset = 0 } = options;
      
      let whereClause = 'WHERE workspace_id = ?';
      let params: any[] = [workspaceId];

      if (search) {
        whereClause += ' AND (name LIKE ? OR search_index LIKE ?)';
        const searchTerm = `%${search.toLowerCase()}%`;
        params.push(searchTerm, searchTerm);
      }

      // Buscar total
      const totalResult = await databaseService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM clients ${whereClause}`,
        params
      );

      // Buscar clientes
      const clientsData = await databaseService.all<ClientData>(
        `SELECT * FROM clients ${whereClause} 
         ORDER BY name ASC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const clients = clientsData.map(data => new Client(data, workspace));

      return {
        clients,
        total: totalResult?.count || 0
      };
    } catch (error) {
      console.error('❌ Erro ao listar clientes:', error);
      throw error;
    }
  }

  /**
   * Busca clientes por nome
   */
  static async findByName(name: string, workspaceId: number, workspace: Workspace): Promise<Client[]> {
    try {
      const clientsData = await databaseService.all<ClientData>(
        'SELECT * FROM clients WHERE workspace_id = ? AND name LIKE ? ORDER BY name ASC',
        [workspaceId, `%${name}%`]
      );

      return clientsData.map(data => new Client(data, workspace));
    } catch (error) {
      console.error('❌ Erro ao buscar clientes por nome:', error);
      throw error;
    }
  }

  /**
   * Conta total de clientes no workspace
   */
  static async count(workspaceId: number): Promise<number> {
    try {
      const result = await databaseService.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM clients WHERE workspace_id = ?',
        [workspaceId]
      );

      return result?.count || 0;
    } catch (error) {
      console.error('❌ Erro ao contar clientes:', error);
      return 0;
    }
  }
}

export default Client;