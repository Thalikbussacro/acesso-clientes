import { databaseService } from '../services/DatabaseService';
import CryptoService, { EncryptedData } from '../services/CryptoService';
import Workspace from './Workspace';

export interface AccessMethodData {
  id?: number;
  client_id: number;
  method_type: string;
  method_name: string;
  fields_encrypted: string;
  created_at?: string;
  updated_at?: string;
}

export interface FieldDefinition {
  name: string;
  type: 'text' | 'password' | 'number' | 'url' | 'email';
  required: boolean;
  label: string;
}

export interface MethodTypeConfig {
  method_type: string;
  fields: FieldDefinition[];
}

export interface CreateAccessMethodRequest {
  method_type: string;
  method_name: string;
  fields: Record<string, any>;
}

export interface UpdateAccessMethodRequest {
  method_name?: string;
  fields?: Record<string, any>;
}

export interface AccessMethodInfo {
  id: number;
  client_id: number;
  method_type: string;
  method_name: string;
  created_at: string;
  updated_at: string;
}

export interface AccessMethodDetails extends AccessMethodInfo {
  fields: Record<string, any>;
}

export class AccessMethod {
  private data: AccessMethodData;
  private workspace: Workspace;

  constructor(data: AccessMethodData, workspace: Workspace) {
    this.data = data;
    this.workspace = workspace;
  }

  // Getters
  get id(): number | undefined {
    return this.data.id;
  }

  get clientId(): number {
    return this.data.client_id;
  }

  get methodType(): string {
    return this.data.method_type;
  }

  get methodName(): string {
    return this.data.method_name;
  }

  get createdAt(): string | undefined {
    return this.data.created_at;
  }

  get updatedAt(): string | undefined {
    return this.data.updated_at;
  }

  /**
   * Descriptografa e retorna os campos
   */
  getDecryptedFields(): Record<string, any> {
    try {
      const encryptedData: EncryptedData = JSON.parse(this.data.fields_encrypted);
      return CryptoService.decryptObject(encryptedData, this.workspace.getMasterKey());
    } catch (error) {
      console.error('❌ Erro ao descriptografar campos:', error);
      throw new Error('Falha ao descriptografar campos do método de acesso');
    }
  }

  /**
   * Criptografa e define os campos
   */
  private setEncryptedFields(fields: Record<string, any>): void {
    try {
      const encryptedData = CryptoService.encryptObject(fields, this.workspace.getMasterKey());
      this.data.fields_encrypted = JSON.stringify(encryptedData);
    } catch (error) {
      console.error('❌ Erro ao criptografar campos:', error);
      throw new Error('Falha ao criptografar campos do método de acesso');
    }
  }

  /**
   * Atualiza dados do método de acesso
   */
  async update(request: UpdateAccessMethodRequest): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (request.method_name !== undefined) {
        updates.push('method_name = ?');
        params.push(request.method_name);
        this.data.method_name = request.method_name;
      }

      if (request.fields !== undefined) {
        this.setEncryptedFields(request.fields);
        updates.push('fields_encrypted = ?');
        params.push(this.data.fields_encrypted);
      }

      if (updates.length === 0) {
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.data.id);

      await databaseService.run(
        `UPDATE access_methods SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    } catch (error) {
      console.error('❌ Erro ao atualizar método de acesso:', error);
      throw error;
    }
  }

  /**
   * Deleta o método de acesso
   */
  async delete(): Promise<void> {
    try {
      await databaseService.run(
        'DELETE FROM access_methods WHERE id = ?',
        [this.data.id]
      );
    } catch (error) {
      console.error('❌ Erro ao deletar método de acesso:', error);
      throw error;
    }
  }

  /**
   * Converte para formato de informações básicas
   */
  toInfo(): AccessMethodInfo {
    return {
      id: this.data.id!,
      client_id: this.data.client_id,
      method_type: this.data.method_type,
      method_name: this.data.method_name,
      created_at: this.data.created_at!,
      updated_at: this.data.updated_at!
    };
  }

  /**
   * Converte para formato com detalhes (campos descriptografados)
   */
  toDetails(): AccessMethodDetails {
    return {
      ...this.toInfo(),
      fields: this.getDecryptedFields()
    };
  }

  // Métodos estáticos

  /**
   * Cria novo método de acesso
   */
  static async create(
    clientId: number, 
    request: CreateAccessMethodRequest, 
    workspace: Workspace
  ): Promise<AccessMethod> {
    try {
      if (!workspace.hasKey) {
        throw new Error('Workspace deve estar desbloqueado para criar método de acesso');
      }

      const accessMethod = new AccessMethod({
        client_id: clientId,
        method_type: request.method_type,
        method_name: request.method_name,
        fields_encrypted: ''
      }, workspace);

      // Criptografar campos
      accessMethod.setEncryptedFields(request.fields);

      // Inserir no banco
      const result = await databaseService.run(
        `INSERT INTO access_methods (client_id, method_type, method_name, fields_encrypted)
         VALUES (?, ?, ?, ?)`,
        [clientId, request.method_type, request.method_name, accessMethod.data.fields_encrypted]
      );

      accessMethod.data.id = result.lastID;
      return accessMethod;
    } catch (error) {
      console.error('❌ Erro ao criar método de acesso:', error);
      throw error;
    }
  }

  /**
   * Busca método de acesso por ID
   */
  static async findById(id: number, workspace: Workspace): Promise<AccessMethod | null> {
    try {
      const data = await databaseService.get<AccessMethodData>(
        'SELECT * FROM access_methods WHERE id = ?',
        [id]
      );

      return data ? new AccessMethod(data, workspace) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar método de acesso:', error);
      throw error;
    }
  }

  /**
   * Lista métodos de acesso de um cliente
   */
  static async findByClientId(clientId: number, workspace: Workspace): Promise<AccessMethod[]> {
    try {
      const methodsData = await databaseService.all<AccessMethodData>(
        'SELECT * FROM access_methods WHERE client_id = ? ORDER BY method_type, method_name',
        [clientId]
      );

      return methodsData.map(data => new AccessMethod(data, workspace));
    } catch (error) {
      console.error('❌ Erro ao buscar métodos de acesso:', error);
      throw error;
    }
  }

  /**
   * Lista métodos de acesso por tipo
   */
  static async findByType(methodType: string, workspace: Workspace): Promise<AccessMethod[]> {
    try {
      const methodsData = await databaseService.all<AccessMethodData>(
        'SELECT * FROM access_methods WHERE method_type = ? ORDER BY method_name',
        [methodType]
      );

      return methodsData.map(data => new AccessMethod(data, workspace));
    } catch (error) {
      console.error('❌ Erro ao buscar métodos por tipo:', error);
      throw error;
    }
  }

  /**
   * Conta métodos de acesso de um cliente
   */
  static async countByClientId(clientId: number): Promise<number> {
    try {
      const result = await databaseService.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM access_methods WHERE client_id = ?',
        [clientId]
      );

      return result?.count || 0;
    } catch (error) {
      console.error('❌ Erro ao contar métodos de acesso:', error);
      return 0;
    }
  }

  /**
   * Obtém tipos de método únicos
   */
  static async getMethodTypes(): Promise<string[]> {
    try {
      const results = await databaseService.all<{ method_type: string }>(
        'SELECT DISTINCT method_type FROM access_methods ORDER BY method_type'
      );

      return results.map(r => r.method_type);
    } catch (error) {
      console.error('❌ Erro ao buscar tipos de método:', error);
      return [];
    }
  }

  // Métodos para configuração de tipos

  /**
   * Salva configuração de tipo de método
   */
  static async saveMethodTypeConfig(
    workspaceId: number, 
    config: MethodTypeConfig
  ): Promise<void> {
    try {
      await databaseService.run(
        `INSERT OR REPLACE INTO method_type_configs 
         (workspace_id, method_type, field_definitions, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [workspaceId, config.method_type, JSON.stringify(config.fields)]
      );
    } catch (error) {
      console.error('❌ Erro ao salvar configuração de tipo:', error);
      throw error;
    }
  }

  /**
   * Obtém configuração de tipo de método
   */
  static async getMethodTypeConfig(
    workspaceId: number, 
    methodType: string
  ): Promise<MethodTypeConfig | null> {
    try {
      const result = await databaseService.get<{
        method_type: string;
        field_definitions: string;
      }>(
        'SELECT method_type, field_definitions FROM method_type_configs WHERE workspace_id = ? AND method_type = ?',
        [workspaceId, methodType]
      );

      if (!result) {
        return null;
      }

      return {
        method_type: result.method_type,
        fields: JSON.parse(result.field_definitions)
      };
    } catch (error) {
      console.error('❌ Erro ao buscar configuração de tipo:', error);
      throw error;
    }
  }

  /**
   * Lista todas as configurações de tipos de método
   */
  static async getAllMethodTypeConfigs(workspaceId: number): Promise<MethodTypeConfig[]> {
    try {
      const results = await databaseService.all<{
        method_type: string;
        field_definitions: string;
      }>(
        'SELECT method_type, field_definitions FROM method_type_configs WHERE workspace_id = ? ORDER BY method_type',
        [workspaceId]
      );

      return results.map(result => ({
        method_type: result.method_type,
        fields: JSON.parse(result.field_definitions)
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar configurações de tipos:', error);
      return [];
    }
  }

  /**
   * Deleta configuração de tipo de método
   */
  static async deleteMethodTypeConfig(workspaceId: number, methodType: string): Promise<void> {
    try {
      await databaseService.run(
        'DELETE FROM method_type_configs WHERE workspace_id = ? AND method_type = ?',
        [workspaceId, methodType]
      );
    } catch (error) {
      console.error('❌ Erro ao deletar configuração de tipo:', error);
      throw error;
    }
  }
}

export default AccessMethod;