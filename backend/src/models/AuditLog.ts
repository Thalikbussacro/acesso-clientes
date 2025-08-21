import { databaseService } from '../services/DatabaseService';
import CryptoService, { EncryptedData } from '../services/CryptoService';
import Workspace from './Workspace';

export interface AuditLogData {
  id?: number;
  workspace_id: number;
  client_id?: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  details_encrypted?: string;
  details_public?: string;
  user_agent?: string;
  ip_address?: string;
  timestamp?: string;
}

export interface CreateAuditLogRequest {
  action: string;
  entity_type: string;
  entity_id?: number;
  client_id?: number;
  details?: Record<string, any>;
  publicDetails?: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuditLogInfo {
  id: number;
  workspace_id: number;
  client_id?: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  publicDetails?: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
  timestamp: string;
}

export interface AuditLogDetails extends AuditLogInfo {
  details?: Record<string, any>;
}

export interface AuditLogFilters {
  clientId?: number;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Tipos de ação predefinidos
export enum AuditAction {
  // Workspace
  WORKSPACE_CREATED = 'workspace_created',
  WORKSPACE_UNLOCKED = 'workspace_unlocked',
  WORKSPACE_LOCKED = 'workspace_locked',
  WORKSPACE_PASSWORD_CHANGED = 'workspace_password_changed',

  // Cliente
  CLIENT_CREATED = 'client_created',
  CLIENT_VIEWED = 'client_viewed',
  CLIENT_UPDATED = 'client_updated',
  CLIENT_DELETED = 'client_deleted',
  CLIENT_NOTES_VIEWED = 'client_notes_viewed',

  // Método de acesso
  ACCESS_METHOD_CREATED = 'access_method_created',
  ACCESS_METHOD_VIEWED = 'access_method_viewed',
  ACCESS_METHOD_UPDATED = 'access_method_updated',
  ACCESS_METHOD_DELETED = 'access_method_deleted',
  ACCESS_METHOD_SECRET_REVEALED = 'access_method_secret_revealed',
  ACCESS_METHOD_SECRET_COPIED = 'access_method_secret_copied',

  // Sistema
  SYSTEM_ERROR = 'system_error',
  SYSTEM_BACKUP = 'system_backup',
  SYSTEM_RESTORE = 'system_restore'
}

// Tipos de entidade
export enum EntityType {
  WORKSPACE = 'workspace',
  CLIENT = 'client',
  ACCESS_METHOD = 'access_method',
  AUDIT_LOG = 'audit_log',
  SYSTEM = 'system'
}

export class AuditLog {
  private data: AuditLogData;
  private workspace?: Workspace;

  constructor(data: AuditLogData, workspace?: Workspace) {
    this.data = data;
    this.workspace = workspace;
  }

  // Getters
  get id(): number | undefined {
    return this.data.id;
  }

  get workspaceId(): number {
    return this.data.workspace_id;
  }

  get clientId(): number | undefined {
    return this.data.client_id;
  }

  get action(): string {
    return this.data.action;
  }

  get entityType(): string {
    return this.data.entity_type;
  }

  get entityId(): number | undefined {
    return this.data.entity_id;
  }

  get userAgent(): string | undefined {
    return this.data.user_agent;
  }

  get ipAddress(): string | undefined {
    return this.data.ip_address;
  }

  get timestamp(): string | undefined {
    return this.data.timestamp;
  }

  /**
   * Descriptografa e retorna os detalhes sensíveis
   */
  getDecryptedDetails(): Record<string, any> | undefined {
    if (!this.data.details_encrypted || !this.workspace?.hasKey) {
      return undefined;
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(this.data.details_encrypted);
      return CryptoService.decryptObject(encryptedData, this.workspace.getMasterKey());
    } catch (error) {
      console.error('❌ Erro ao descriptografar detalhes do log:', error);
      return undefined;
    }
  }

  /**
   * Retorna detalhes públicos
   */
  getPublicDetails(): Record<string, any> | undefined {
    if (!this.data.details_public) {
      return undefined;
    }

    try {
      return JSON.parse(this.data.details_public);
    } catch (error) {
      console.error('❌ Erro ao parsear detalhes públicos:', error);
      return undefined;
    }
  }

  /**
   * Converte para formato de informações básicas
   */
  toInfo(): AuditLogInfo {
    return {
      id: this.data.id!,
      workspace_id: this.data.workspace_id,
      client_id: this.data.client_id,
      action: this.data.action,
      entity_type: this.data.entity_type,
      entity_id: this.data.entity_id,
      publicDetails: this.getPublicDetails(),
      user_agent: this.data.user_agent,
      ip_address: this.data.ip_address,
      timestamp: this.data.timestamp!
    };
  }

  /**
   * Converte para formato com detalhes (inclui dados sensíveis descriptografados)
   */
  toDetails(): AuditLogDetails {
    return {
      ...this.toInfo(),
      details: this.getDecryptedDetails()
    };
  }

  // Métodos estáticos

  /**
   * Cria novo log de auditoria
   */
  static async create(
    workspaceId: number,
    request: CreateAuditLogRequest,
    workspace?: Workspace
  ): Promise<AuditLog> {
    try {
      let encryptedDetails: string | undefined;
      let publicDetails: string | undefined;

      // Criptografar detalhes sensíveis se fornecidos
      if (request.details && workspace?.hasKey) {
        const encryptedData = CryptoService.encryptObject(request.details, workspace.getMasterKey());
        encryptedDetails = JSON.stringify(encryptedData);
      }

      // Serializar detalhes públicos
      if (request.publicDetails) {
        publicDetails = JSON.stringify(request.publicDetails);
      }

      const result = await databaseService.run(
        `INSERT INTO audit_logs 
         (workspace_id, client_id, action, entity_type, entity_id, details_encrypted, details_public, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workspaceId,
          request.client_id || null,
          request.action,
          request.entity_type,
          request.entity_id || null,
          encryptedDetails || null,
          publicDetails || null,
          request.userAgent || null,
          request.ipAddress || null
        ]
      );

      const auditLog = new AuditLog({
        id: result.lastID,
        workspace_id: workspaceId,
        client_id: request.client_id,
        action: request.action,
        entity_type: request.entity_type,
        entity_id: request.entity_id,
        details_encrypted: encryptedDetails,
        details_public: publicDetails,
        user_agent: request.userAgent,
        ip_address: request.ipAddress
      }, workspace);

      return auditLog;
    } catch (error) {
      console.error('❌ Erro ao criar log de auditoria:', error);
      // Não deve falhar a operação principal se o log falhar
      throw error;
    }
  }

  /**
   * Busca log por ID
   */
  static async findById(id: number, workspace?: Workspace): Promise<AuditLog | null> {
    try {
      const data = await databaseService.get<AuditLogData>(
        'SELECT * FROM audit_logs WHERE id = ?',
        [id]
      );

      return data ? new AuditLog(data, workspace) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar log de auditoria:', error);
      throw error;
    }
  }

  /**
   * Lista logs com filtros e paginação
   */
  static async findAll(
    workspaceId: number,
    filters: AuditLogFilters = {},
    workspace?: Workspace
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const { limit = 100, offset = 0 } = filters;
      
      let whereClause = 'WHERE workspace_id = ?';
      let params: any[] = [workspaceId];

      // Adicionar filtros
      if (filters.clientId) {
        whereClause += ' AND client_id = ?';
        params.push(filters.clientId);
      }

      if (filters.action) {
        whereClause += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters.entityType) {
        whereClause += ' AND entity_type = ?';
        params.push(filters.entityType);
      }

      if (filters.startDate) {
        whereClause += ' AND timestamp >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND timestamp <= ?';
        params.push(filters.endDate);
      }

      // Buscar total
      const totalResult = await databaseService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
        params
      );

      // Buscar logs
      const logsData = await databaseService.all<AuditLogData>(
        `SELECT * FROM audit_logs ${whereClause} 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const logs = logsData.map(data => new AuditLog(data, workspace));

      return {
        logs,
        total: totalResult?.count || 0
      };
    } catch (error) {
      console.error('❌ Erro ao listar logs de auditoria:', error);
      throw error;
    }
  }

  /**
   * Busca logs de um cliente específico
   */
  static async findByClientId(
    clientId: number,
    workspaceId: number,
    workspace?: Workspace,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const logsData = await databaseService.all<AuditLogData>(
        'SELECT * FROM audit_logs WHERE workspace_id = ? AND client_id = ? ORDER BY timestamp DESC LIMIT ?',
        [workspaceId, clientId, limit]
      );

      return logsData.map(data => new AuditLog(data, workspace));
    } catch (error) {
      console.error('❌ Erro ao buscar logs por cliente:', error);
      throw error;
    }
  }

  /**
   * Busca logs por ação
   */
  static async findByAction(
    action: string,
    workspaceId: number,
    workspace?: Workspace,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const logsData = await databaseService.all<AuditLogData>(
        'SELECT * FROM audit_logs WHERE workspace_id = ? AND action = ? ORDER BY timestamp DESC LIMIT ?',
        [workspaceId, action, limit]
      );

      return logsData.map(data => new AuditLog(data, workspace));
    } catch (error) {
      console.error('❌ Erro ao buscar logs por ação:', error);
      throw error;
    }
  }

  /**
   * Conta logs por período
   */
  static async countByPeriod(
    workspaceId: number,
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      const result = await databaseService.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM audit_logs WHERE workspace_id = ? AND timestamp BETWEEN ? AND ?',
        [workspaceId, startDate, endDate]
      );

      return result?.count || 0;
    } catch (error) {
      console.error('❌ Erro ao contar logs por período:', error);
      return 0;
    }
  }

  /**
   * Limpa logs antigos
   */
  static async cleanupOldLogs(workspaceId: number, daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await databaseService.run(
        'DELETE FROM audit_logs WHERE workspace_id = ? AND timestamp < ?',
        [workspaceId, cutoffDate.toISOString()]
      );

      return result.changes;
    } catch (error) {
      console.error('❌ Erro ao limpar logs antigos:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de ações
   */
  static async getActionStats(workspaceId: number, days: number = 30): Promise<Record<string, number>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await databaseService.all<{ action: string; count: number }>(
        `SELECT action, COUNT(*) as count 
         FROM audit_logs 
         WHERE workspace_id = ? AND timestamp >= ? 
         GROUP BY action 
         ORDER BY count DESC`,
        [workspaceId, startDate.toISOString()]
      );

      const stats: Record<string, number> = {};
      for (const result of results) {
        stats[result.action] = result.count;
      }

      return stats;
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas de ações:', error);
      return {};
    }
  }
}

export default AuditLog;