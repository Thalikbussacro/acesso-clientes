import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Workspace from '../models/Workspace';
import AuditLog, { AuditAction, EntityType } from '../models/AuditLog';

// Estender Request para incluir dados do workspace
declare global {
  namespace Express {
    interface Request {
      workspace?: Workspace;
      sessionData?: {
        workspaceId: number;
        sessionId: string;
        fingerprint: string;
        unlocked: boolean;
        lastActivity: number;
      };
    }
  }
}

export interface SessionData {
  workspaceId: number;
  sessionId: string;
  fingerprint: string;
  unlocked: boolean;
  lastActivity: number;
  workspace?: Workspace;
}

// Configurações de sessão
const JWT_SECRET = process.env.JWT_SECRET || 'temp-secret-change-in-production';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const CLIENT_ACCESS_TIMEOUT = 5 * 60 * 1000; // 5 minutos para acesso a cliente

// Armazenamento de sessões em memória (em produção usar Redis)
const activeSessions = new Map<string, SessionData>();

/**
 * Middleware para verificar se existe workspace configurado
 */
export const requireWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hasWorkspace = await Workspace.exists();
    
    if (!hasWorkspace) {
      res.status(404).json({
        error: 'WORKSPACE_NOT_FOUND',
        message: 'Nenhum workspace configurado. Configure primeiro.'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('❌ Erro ao verificar workspace:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para validar token JWT e carregar sessão
 */
export const validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'NO_TOKEN',
        message: 'Token de autorização necessário'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    // Verificar token JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Token inválido ou expirado'
      });
      return;
    }

    // Buscar sessão ativa
    const session = activeSessions.get(decoded.sessionId);
    if (!session) {
      res.status(401).json({
        error: 'SESSION_NOT_FOUND',
        message: 'Sessão não encontrada ou expirada'
      });
      return;
    }

    // Verificar timeout de sessão
    const now = Date.now();
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      activeSessions.delete(decoded.sessionId);
      res.status(401).json({
        error: 'SESSION_EXPIRED',
        message: 'Sessão expirada'
      });
      return;
    }

    // Usar workspace da sessão se disponível (mantém chave mestre), senão carregar do banco
    let workspace = session.workspace;
    if (!workspace) {
      const loadedWorkspace = await Workspace.findById(session.workspaceId);
      if (!loadedWorkspace) {
        res.status(404).json({
          error: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace não encontrado'
        });
        return;
      }
      workspace = loadedWorkspace;
    }

    // Atualizar última atividade
    session.lastActivity = now;
    activeSessions.set(decoded.sessionId, session);

    // Adicionar ao request
    req.workspace = workspace;
    req.sessionData = session;

    next();
  } catch (error) {
    console.error('❌ Erro na validação de sessão:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para garantir que o workspace está desbloqueado (Gate 1)
 */
export const requireUnlockedWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.workspace || !req.sessionData) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Sessão não válida'
      });
      return;
    }

    if (!req.sessionData.unlocked) {
      res.status(423).json({
        error: 'WORKSPACE_LOCKED',
        message: 'Workspace bloqueado. Faça unlock primeiro.'
      });
      return;
    }

    // Verificar se workspace ainda tem a chave
    if (!req.workspace.hasKey) {
      res.status(423).json({
        error: 'WORKSPACE_LOCKED',
        message: 'Workspace bloqueado. Faça unlock primeiro.'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('❌ Erro ao verificar workspace desbloqueado:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para validar acesso a cliente específico (Gate 2)
 */
export const requireClientAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.workspace || !req.sessionData) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Sessão não válida'
      });
      return;
    }

    // Verificar se tem permissão temporária para cliente
    const clientId = req.params.clientId || req.body.clientId;
    const sessionKey = `client_access_${req.sessionData.sessionId}_${clientId}`;
    
    // Aqui o frontend deve ter enviado uma validação de senha recente
    // Por enquanto, vamos assumir que o Gate 2 foi validado se chegou até aqui
    // A validação real do Gate 2 será feita no controller específico

    next();
  } catch (error) {
    console.error('❌ Erro ao verificar acesso ao cliente:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para logging automático de auditoria
 */
export const auditLog = (action: string, entityType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Executar próximo middleware primeiro
      next();

      // Registrar log após a resposta (não bloquear)
      setImmediate(async () => {
        try {
          if (!req.workspace || !req.sessionData) {
            return;
          }

          const entityId = req.params.id || req.params.clientId || req.body.id;
          const clientId = req.params.clientId || req.body.clientId;
          
          await AuditLog.create(
            req.workspace.id!,
            {
              action,
              entity_type: entityType,
              entity_id: entityId ? parseInt(entityId) : undefined,
              client_id: clientId ? parseInt(clientId) : undefined,
              publicDetails: {
                method: req.method,
                path: req.path,
                status: res.statusCode
              },
              userAgent: req.headers['user-agent'],
              ipAddress: req.ip || req.connection.remoteAddress
            },
            req.workspace
          );
        } catch (error) {
          console.error('❌ Erro ao registrar log de auditoria:', error);
          // Não falha a requisição se o log falhar
        }
      });
    } catch (error) {
      console.error('❌ Erro no middleware de auditoria:', error);
      next();
    }
  };
};

/**
 * Cria nova sessão
 */
export const createSession = async (workspace: Workspace, userAgent?: string, ipAddress?: string): Promise<string> => {
  try {
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    const fingerprint = require('crypto').createHash('sha256')
      .update(`${userAgent || ''}|${ipAddress || ''}|${Date.now()}`)
      .digest('hex');

    const sessionData: SessionData = {
      workspaceId: workspace.id!,
      sessionId,
      fingerprint,
      unlocked: false,
      lastActivity: Date.now()
    };

    activeSessions.set(sessionId, sessionData);

    // Criar token JWT
    const token = jwt.sign(
      { 
        sessionId, 
        workspaceId: workspace.id,
        fingerprint 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return token;
  } catch (error) {
    console.error('❌ Erro ao criar sessão:', error);
    throw new Error('Falha ao criar sessão');
  }
};

/**
 * Desbloqueia workspace na sessão
 */
export const unlockWorkspaceSession = (sessionId: string, workspace?: Workspace): boolean => {
  try {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.unlocked = true;
    session.lastActivity = Date.now();
    if (workspace) {
      session.workspace = workspace;
    }
    activeSessions.set(sessionId, session);

    return true;
  } catch (error) {
    console.error('❌ Erro ao desbloquear sessão:', error);
    return false;
  }
};

/**
 * Bloqueia workspace na sessão
 */
export const lockWorkspaceSession = (sessionId: string): boolean => {
  try {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.unlocked = false;
    session.lastActivity = Date.now();
    activeSessions.set(sessionId, session);

    return true;
  } catch (error) {
    console.error('❌ Erro ao bloquear sessão:', error);
    return false;
  }
};

/**
 * Destrói sessão
 */
export const destroySession = (sessionId: string): boolean => {
  try {
    return activeSessions.delete(sessionId);
  } catch (error) {
    console.error('❌ Erro ao destruir sessão:', error);
    return false;
  }
};

/**
 * Limpa sessões expiradas
 */
export const cleanupExpiredSessions = (): number => {
  try {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of activeSessions.entries()) {
      if (now - session.lastActivity > SESSION_TIMEOUT) {
        activeSessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Limpas ${cleaned} sessões expiradas`);
    }

    return cleaned;
  } catch (error) {
    console.error('❌ Erro ao limpar sessões:', error);
    return 0;
  }
};

// Limpar sessões expiradas a cada 10 minutos
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);

export default {
  requireWorkspace,
  validateSession,
  requireUnlockedWorkspace,
  requireClientAccess,
  auditLog,
  createSession,
  unlockWorkspaceSession,
  lockWorkspaceSession,
  destroySession,
  cleanupExpiredSessions
};