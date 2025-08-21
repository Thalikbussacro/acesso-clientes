import { databaseService } from '../services/DatabaseService';
import CryptoService from '../services/CryptoService';

export interface WorkspaceData {
  id?: number;
  name: string;
  password_hash: string;
  salt: string;
  encryption_key_hash: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  password: string;
}

export interface WorkspaceInfo {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  hasData: boolean;
}

export class Workspace {
  private data: WorkspaceData;
  private masterKey?: Buffer;

  constructor(data: WorkspaceData) {
    this.data = data;
  }

  // Getters
  get id(): number | undefined {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get createdAt(): string | undefined {
    return this.data.created_at;
  }

  get updatedAt(): string | undefined {
    return this.data.updated_at;
  }

  get hasKey(): boolean {
    return this.masterKey !== undefined;
  }

  /**
   * Define a chave mestre para este workspace
   */
  setMasterKey(key: Buffer): void {
    this.masterKey = key;
  }

  /**
   * Obtém a chave mestre (se disponível)
   */
  getMasterKey(): Buffer {
    if (!this.masterKey) {
      throw new Error('Chave mestre não disponível - faça unlock primeiro');
    }
    return this.masterKey;
  }

  /**
   * Valida senha e deriva chave mestre
   */
  async unlock(password: string): Promise<boolean> {
    try {
      // Verificar senha
      const isValid = await CryptoService.verifyPassword(password, this.data.password_hash);
      if (!isValid) {
        return false;
      }

      // Derivar chave mestre
      const salt = Buffer.from(this.data.salt, 'hex');
      const derivedKey = CryptoService.deriveKey(password, salt);

      // Validar chave contra hash
      const isKeyValid = CryptoService.validateKeyHash(derivedKey, this.data.encryption_key_hash);
      if (!isKeyValid) {
        return false;
      }

      // Armazenar chave
      this.masterKey = derivedKey;
      return true;
    } catch (error) {
      console.error('❌ Erro no unlock do workspace:', error);
      return false;
    }
  }

  /**
   * Limpa a chave mestre da memória
   */
  lock(): void {
    if (this.masterKey) {
      CryptoService.clearSensitiveData(this.masterKey);
      this.masterKey = undefined;
    }
  }

  /**
   * Atualiza senha do workspace
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Verificar senha atual
      if (!(await this.unlock(currentPassword))) {
        return false;
      }

      // Validar força da nova senha
      const strength = CryptoService.validatePasswordStrength(newPassword);
      if (!strength.isValid) {
        throw new Error(`Senha fraca: ${strength.suggestions.join(', ')}`);
      }

      // Gerar nova chave mestre
      const { key: newMasterKey, salt: newSalt } = CryptoService.generateMasterKey(newPassword);
      const newPasswordHash = await CryptoService.hashPassword(newPassword);
      const newKeyHash = CryptoService.createKeyHash(newMasterKey);

      // Atualizar no banco
      await databaseService.run(
        `UPDATE workspaces 
         SET password_hash = ?, salt = ?, encryption_key_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newPasswordHash, newSalt.toString('hex'), newKeyHash, this.data.id]
      );

      // Atualizar dados locais
      this.data.password_hash = newPasswordHash;
      this.data.salt = newSalt.toString('hex');
      this.data.encryption_key_hash = newKeyHash;
      this.masterKey = newMasterKey;

      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar senha:', error);
      throw error;
    }
  }

  /**
   * Converte para formato seguro (sem dados sensíveis)
   */
  toSafeObject(): WorkspaceInfo {
    return {
      id: this.data.id!,
      name: this.data.name,
      created_at: this.data.created_at!,
      updated_at: this.data.updated_at!,
      hasData: this.hasKey
    };
  }

  // Métodos estáticos

  /**
   * Cria novo workspace
   */
  static async create(request: CreateWorkspaceRequest): Promise<Workspace> {
    try {
      // Validar força da senha
      const strength = CryptoService.validatePasswordStrength(request.password);
      if (!strength.isValid) {
        throw new Error(`Senha fraca: ${strength.suggestions.join(', ')}`);
      }

      // Verificar se já existe workspace
      const existing = await this.findFirst();
      if (existing) {
        throw new Error('Já existe um workspace configurado');
      }

      // Gerar hashes e chaves
      const passwordHash = await CryptoService.hashPassword(request.password);
      const { key: masterKey, salt } = CryptoService.generateMasterKey(request.password);
      const keyHash = CryptoService.createKeyHash(masterKey);

      // Inserir no banco
      const result = await databaseService.run(
        `INSERT INTO workspaces (name, password_hash, salt, encryption_key_hash)
         VALUES (?, ?, ?, ?)`,
        [request.name, passwordHash, salt.toString('hex'), keyHash]
      );

      // Retornar instância
      const workspace = new Workspace({
        id: result.lastID,
        name: request.name,
        password_hash: passwordHash,
        salt: salt.toString('hex'),
        encryption_key_hash: keyHash
      });

      workspace.setMasterKey(masterKey);
      return workspace;
    } catch (error) {
      console.error('❌ Erro ao criar workspace:', error);
      throw error;
    }
  }

  /**
   * Busca workspace por ID
   */
  static async findById(id: number): Promise<Workspace | null> {
    try {
      const data = await databaseService.get<WorkspaceData>(
        'SELECT * FROM workspaces WHERE id = ?',
        [id]
      );

      return data ? new Workspace(data) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar workspace:', error);
      throw error;
    }
  }

  /**
   * Busca primeiro workspace (normalmente só há um)
   */
  static async findFirst(): Promise<Workspace | null> {
    try {
      const data = await databaseService.get<WorkspaceData>(
        'SELECT * FROM workspaces ORDER BY id ASC LIMIT 1'
      );

      return data ? new Workspace(data) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar workspace:', error);
      throw error;
    }
  }

  /**
   * Verifica se existe algum workspace
   */
  static async exists(): Promise<boolean> {
    try {
      return await databaseService.hasWorkspace();
    } catch (error) {
      console.error('❌ Erro ao verificar workspace:', error);
      return false;
    }
  }

  /**
   * Deleta workspace (cuidado!)
   */
  static async delete(id: number): Promise<boolean> {
    try {
      const result = await databaseService.run(
        'DELETE FROM workspaces WHERE id = ?',
        [id]
      );

      return result.changes > 0;
    } catch (error) {
      console.error('❌ Erro ao deletar workspace:', error);
      throw error;
    }
  }
}

export default Workspace;