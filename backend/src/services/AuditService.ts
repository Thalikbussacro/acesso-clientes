import AuditLog, { 
  AuditAction, 
  EntityType, 
  CreateAuditLogRequest,
  AuditLogFilters 
} from '../models/AuditLog';
import Workspace from '../models/Workspace';

export interface AuditContext {
  workspace: Workspace;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface AuditEvent {
  action: AuditAction | string;
  entityType: EntityType | string;
  entityId?: number;
  clientId?: number;
  details?: Record<string, any>;
  publicDetails?: Record<string, any>;
}

export interface AuditReport {
  logs: any[];
  total: number;
  summary: {
    totalActions: number;
    uniqueClients: number;
    timeRange: {
      start: string;
      end: string;
    };
    topActions: Array<{
      action: string;
      count: number;
    }>;
  };
}

export class AuditService {
  /**
   * Registra evento de auditoria
   */
  static async logEvent(context: AuditContext, event: AuditEvent): Promise<AuditLog | null> {
    try {
      const request: CreateAuditLogRequest = {
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        client_id: event.clientId,
        details: event.details,
        publicDetails: {
          ...event.publicDetails,
          sessionId: context.sessionId?.substring(0, 8) // Apenas parte do session ID
        },
        userAgent: context.userAgent,
        ipAddress: context.ipAddress
      };

      return await AuditLog.create(context.workspace.id!, request, context.workspace);
    } catch (error) {
      console.error('❌ Erro ao registrar evento de auditoria:', error);
      // Não deve falhar a operação principal se o log falhar
      return null;
    }
  }

  /**
   * Logs específicos para workspace
   */
  static async logWorkspaceEvent(
    context: AuditContext, 
    action: AuditAction, 
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(context, {
      action,
      entityType: EntityType.WORKSPACE,
      entityId: context.workspace.id,
      details,
      publicDetails: {
        workspaceId: context.workspace.id,
        workspaceName: context.workspace.name
      }
    });
  }

  /**
   * Logs específicos para cliente
   */
  static async logClientEvent(
    context: AuditContext,
    action: AuditAction,
    clientId: number,
    clientName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(context, {
      action,
      entityType: EntityType.CLIENT,
      entityId: clientId,
      clientId,
      details,
      publicDetails: {
        clientId,
        clientName
      }
    });
  }

  /**
   * Logs específicos para método de acesso
   */
  static async logAccessMethodEvent(
    context: AuditContext,
    action: AuditAction,
    methodId: number,
    clientId: number,
    methodType?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(context, {
      action,
      entityType: EntityType.ACCESS_METHOD,
      entityId: methodId,
      clientId,
      details,
      publicDetails: {
        methodId,
        clientId,
        methodType
      }
    });
  }

  /**
   * Log para revelação de segredo (crítico)
   */
  static async logSecretRevealed(
    context: AuditContext,
    methodId: number,
    clientId: number,
    fieldName: string,
    methodType: string
  ): Promise<void> {
    await this.logEvent(context, {
      action: AuditAction.ACCESS_METHOD_SECRET_REVEALED,
      entityType: EntityType.ACCESS_METHOD,
      entityId: methodId,
      clientId,
      details: {
        fieldName,
        revealedAt: new Date().toISOString(),
        securityLevel: 'HIGH'
      },
      publicDetails: {
        methodId,
        clientId,
        methodType,
        fieldRevealed: fieldName,
        alertLevel: 'HIGH'
      }
    });
  }

  /**
   * Log para cópia de segredo (crítico)
   */
  static async logSecretCopied(
    context: AuditContext,
    methodId: number,
    clientId: number,
    fieldName: string,
    methodType: string
  ): Promise<void> {
    await this.logEvent(context, {
      action: AuditAction.ACCESS_METHOD_SECRET_COPIED,
      entityType: EntityType.ACCESS_METHOD,
      entityId: methodId,
      clientId,
      details: {
        fieldName,
        copiedAt: new Date().toISOString(),
        securityLevel: 'CRITICAL'
      },
      publicDetails: {
        methodId,
        clientId,
        methodType,
        fieldCopied: fieldName,
        alertLevel: 'CRITICAL'
      }
    });
  }

  /**
   * Log para erro do sistema
   */
  static async logSystemError(
    context: AuditContext,
    error: Error,
    operation: string,
    entityType?: string,
    entityId?: number
  ): Promise<void> {
    await this.logEvent(context, {
      action: AuditAction.SYSTEM_ERROR,
      entityType: EntityType.SYSTEM,
      entityId,
      details: {
        errorMessage: error.message,
        errorStack: error.stack,
        operation,
        timestamp: new Date().toISOString()
      },
      publicDetails: {
        operation,
        errorType: error.constructor.name,
        entityType,
        entityId
      }
    });
  }

  /**
   * Busca logs com filtros
   */
  static async getLogs(
    workspace: Workspace,
    filters: AuditLogFilters = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      return await AuditLog.findAll(workspace.id!, filters, workspace);
    } catch (error) {
      console.error('❌ Erro ao buscar logs de auditoria:', error);
      throw error;
    }
  }

  /**
   * Busca logs de um cliente específico
   */
  static async getClientLogs(
    workspace: Workspace,
    clientId: number,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await AuditLog.findByClientId(clientId, workspace.id!, workspace, limit);
    } catch (error) {
      console.error('❌ Erro ao buscar logs do cliente:', error);
      throw error;
    }
  }

  /**
   * Busca logs por ação
   */
  static async getLogsByAction(
    workspace: Workspace,
    action: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await AuditLog.findByAction(action, workspace.id!, workspace, limit);
    } catch (error) {
      console.error('❌ Erro ao buscar logs por ação:', error);
      throw error;
    }
  }

  /**
   * Gera relatório de auditoria
   */
  static async generateReport(
    workspace: Workspace,
    filters: AuditLogFilters = {}
  ): Promise<AuditReport> {
    try {
      const { logs, total } = await this.getLogs(workspace, filters);
      
      // Calcular estatísticas
      const uniqueClients = new Set(
        logs.map(log => log.clientId).filter(id => id !== undefined)
      ).size;

      // Contar ações
      const actionCounts = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      // Determinar período
      const timestamps = logs.map(log => log.timestamp!).filter(Boolean);
      const timeRange = {
        start: timestamps.length > 0 ? Math.min(...timestamps.map(t => new Date(t).getTime())) : Date.now(),
        end: timestamps.length > 0 ? Math.max(...timestamps.map(t => new Date(t).getTime())) : Date.now()
      };

      return {
        logs: logs.map(log => log.toInfo()),
        total,
        summary: {
          totalActions: total,
          uniqueClients,
          timeRange: {
            start: new Date(timeRange.start).toISOString(),
            end: new Date(timeRange.end).toISOString()
          },
          topActions
        }
      };
    } catch (error) {
      console.error('❌ Erro ao gerar relatório de auditoria:', error);
      throw error;
    }
  }

  /**
   * Exporta logs para CSV
   */
  static async exportToCSV(
    workspace: Workspace,
    filters: AuditLogFilters = {}
  ): Promise<string> {
    try {
      const { logs } = await this.getLogs(workspace, filters);
      
      const headers = [
        'ID',
        'Timestamp',
        'Action',
        'Entity Type',
        'Entity ID',
        'Client ID',
        'User Agent',
        'IP Address'
      ];

      const rows = logs.map(log => [
        log.id,
        log.timestamp,
        log.action,
        log.entityType,
        log.entityId || '',
        log.clientId || '',
        log.userAgent || '',
        log.ipAddress || ''
      ]);

      return [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    } catch (error) {
      console.error('❌ Erro ao exportar logs para CSV:', error);
      throw error;
    }
  }

  /**
   * Exporta logs para JSON
   */
  static async exportToJSON(
    workspace: Workspace,
    filters: AuditLogFilters = {}
  ): Promise<string> {
    try {
      const { logs, total } = await this.getLogs(workspace, filters);
      
      const exportData = {
        export: {
          timestamp: new Date().toISOString(),
          workspace: workspace.toSafeObject(),
          filters,
          total,
          logs: logs.map(log => log.toInfo())
        }
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('❌ Erro ao exportar logs para JSON:', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de ações
   */
  static async getActionStats(
    workspace: Workspace,
    days: number = 30
  ): Promise<Record<string, number>> {
    try {
      return await AuditLog.getActionStats(workspace.id!, days);
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas de ações:', error);
      throw error;
    }
  }

  /**
   * Limpa logs antigos
   */
  static async cleanupOldLogs(
    workspace: Workspace,
    daysToKeep: number = 365
  ): Promise<number> {
    try {
      const deletedCount = await AuditLog.cleanupOldLogs(workspace.id!, daysToKeep);
      
      // Registrar limpeza
      await this.logEvent(
        { workspace },
        {
          action: 'LOGS_CLEANUP',
          entityType: EntityType.SYSTEM,
          publicDetails: {
            deletedCount,
            daysToKeep,
            cleanupDate: new Date().toISOString()
          }
        }
      );

      return deletedCount;
    } catch (error) {
      console.error('❌ Erro ao limpar logs antigos:', error);
      throw error;
    }
  }

  /**
   * Verifica atividade suspeita
   */
  static async detectSuspiciousActivity(
    workspace: Workspace,
    hours: number = 1
  ): Promise<{
    suspicious: boolean;
    alerts: Array<{
      type: string;
      count: number;
      threshold: number;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
  }> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const { logs } = await this.getLogs(workspace, {
        startDate: startTime,
        limit: 1000
      });

      const alerts: any[] = [];
      let suspicious = false;

      // Detectar muitas tentativas de login falhadas
      const failedLogins = logs.filter(log => 
        log.action === 'INVALID_PASSWORD' || log.action === 'UNAUTHORIZED'
      ).length;
      
      if (failedLogins > 10) {
        alerts.push({
          type: 'EXCESSIVE_FAILED_LOGINS',
          count: failedLogins,
          threshold: 10,
          severity: 'HIGH' as const
        });
        suspicious = true;
      }

      // Detectar muitas revelações de segredo
      const secretReveals = logs.filter(log => 
        log.action === AuditAction.ACCESS_METHOD_SECRET_REVEALED
      ).length;
      
      if (secretReveals > 50) {
        alerts.push({
          type: 'EXCESSIVE_SECRET_REVEALS',
          count: secretReveals,
          threshold: 50,
          severity: 'MEDIUM' as const
        });
        suspicious = true;
      }

      // Detectar acessos de IPs diferentes
      const uniqueIPs = new Set(
        logs.map(log => log.ipAddress).filter(ip => ip)
      ).size;
      
      if (uniqueIPs > 3) {
        alerts.push({
          type: 'MULTIPLE_IP_ADDRESSES',
          count: uniqueIPs,
          threshold: 3,
          severity: 'MEDIUM' as const
        });
        suspicious = true;
      }

      return {
        suspicious,
        alerts
      };
    } catch (error) {
      console.error('❌ Erro ao detectar atividade suspeita:', error);
      return {
        suspicious: false,
        alerts: []
      };
    }
  }
}

export default AuditService;