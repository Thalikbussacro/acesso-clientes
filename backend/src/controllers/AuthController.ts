import { Request, Response } from 'express';
import Workspace from '../models/Workspace';
import AuditLog, { AuditAction, EntityType } from '../models/AuditLog';
import CryptoService from '../services/CryptoService';
import { 
  createSession, 
  unlockWorkspaceSession, 
  lockWorkspaceSession, 
  destroySession 
} from '../middleware/auth';

export interface CreateWorkspaceRequest {
  name: string;
  password: string;
}

export interface LoginRequest {
  password: string;
}

export interface UnlockRequest {
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class AuthController {
  /**
   * Verifica status do sistema
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const hasWorkspace = await Workspace.exists();
      
      res.json({
        hasWorkspace,
        needsSetup: !hasWorkspace,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Cria novo workspace (primeiro uso)
   */
  static async createWorkspace(req: Request, res: Response): Promise<void> {
    try {
      const { name, password }: CreateWorkspaceRequest = req.body;

      // Validações
      if (!name || !password) {
        res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Nome e senha são obrigatórios'
        });
        return;
      }

      // Verificar se já existe workspace
      const existingWorkspace = await Workspace.exists();
      if (existingWorkspace) {
        res.status(409).json({
          error: 'WORKSPACE_EXISTS',
          message: 'Workspace já configurado'
        });
        return;
      }

      // Validar força da senha
      const passwordStrength = CryptoService.validatePasswordStrength(password);
      if (!passwordStrength.isValid) {
        res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Senha muito fraca',
          suggestions: passwordStrength.suggestions
        });
        return;
      }

      // Criar workspace
      const workspace = await Workspace.create({ name, password });

      // Criar sessão inicial
      const token = await createSession(
        workspace, 
        req.headers['user-agent'], 
        req.ip || req.connection.remoteAddress
      );

      // Registrar log
      await AuditLog.create(
        workspace.id!,
        {
          action: AuditAction.WORKSPACE_CREATED,
          entity_type: EntityType.WORKSPACE,
          entity_id: workspace.id,
          publicDetails: {
            workspaceName: name
          },
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip || req.connection.remoteAddress
        },
        workspace
      );

      res.status(201).json({
        message: 'Workspace criado com sucesso',
        workspace: workspace.toSafeObject(),
        token
      });
    } catch (error) {
      console.error('❌ Erro ao criar workspace:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  }

  /**
   * Login inicial (cria sessão)
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { password }: LoginRequest = req.body;

      if (!password) {
        res.status(400).json({
          error: 'MISSING_PASSWORD',
          message: 'Senha é obrigatória'
        });
        return;
      }

      // Buscar workspace
      const workspace = await Workspace.findFirst();
      if (!workspace) {
        res.status(404).json({
          error: 'WORKSPACE_NOT_FOUND',
          message: 'Nenhum workspace configurado'
        });
        return;
      }

      // Validar senha (mas não desbloquear ainda)
      const isValidPassword = await workspace.unlock(password);
      if (!isValidPassword) {
        res.status(401).json({
          error: 'INVALID_PASSWORD',
          message: 'Senha inválida'
        });
        return;
      }

      // Bloquear novamente (o unlock será feito em chamada separada)
      workspace.lock();

      // Criar sessão (ainda bloqueada)
      const token = await createSession(
        workspace,
        req.headers['user-agent'],
        req.ip || req.connection.remoteAddress
      );

      res.json({
        message: 'Login realizado com sucesso',
        workspace: workspace.toSafeObject(),
        token,
        unlocked: false
      });
    } catch (error) {
      console.error('❌ Erro no login:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Unlock workspace (Gate 1)
   */
  static async unlockWorkspace(req: Request, res: Response): Promise<void> {
    try {
      const { password }: UnlockRequest = req.body;

      if (!password) {
        res.status(400).json({
          error: 'MISSING_PASSWORD',
          message: 'Senha é obrigatória'
        });
        return;
      }

      if (!req.workspace || !req.sessionData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Sessão inválida'
        });
        return;
      }

      // Validar senha e desbloquear workspace
      const isUnlocked = await req.workspace.unlock(password);
      if (!isUnlocked) {
        res.status(401).json({
          error: 'INVALID_PASSWORD',
          message: 'Senha inválida'
        });
        return;
      }

      // Marcar sessão como desbloqueada e armazenar workspace
      unlockWorkspaceSession(req.sessionData.sessionId, req.workspace);

      // Registrar log
      await AuditLog.create(
        req.workspace.id!,
        {
          action: AuditAction.WORKSPACE_UNLOCKED,
          entity_type: EntityType.WORKSPACE,
          entity_id: req.workspace.id,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip || req.connection.remoteAddress
        },
        req.workspace
      );

      res.json({
        message: 'Workspace desbloqueado com sucesso',
        unlocked: true
      });
    } catch (error) {
      console.error('❌ Erro no unlock:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Lock workspace
   */
  static async lockWorkspace(req: Request, res: Response): Promise<void> {
    try {
      if (!req.workspace || !req.sessionData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Sessão inválida'
        });
        return;
      }

      // Bloquear workspace
      req.workspace.lock();

      // Marcar sessão como bloqueada
      lockWorkspaceSession(req.sessionData.sessionId);

      // Registrar log
      await AuditLog.create(
        req.workspace.id!,
        {
          action: AuditAction.WORKSPACE_LOCKED,
          entity_type: EntityType.WORKSPACE,
          entity_id: req.workspace.id,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip || req.connection.remoteAddress
        }
      );

      res.json({
        message: 'Workspace bloqueado com sucesso',
        unlocked: false
      });
    } catch (error) {
      console.error('❌ Erro no lock:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Logout (destrói sessão)
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.workspace || !req.sessionData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Sessão inválida'
        });
        return;
      }

      // Bloquear workspace
      req.workspace.lock();

      // Destruir sessão
      destroySession(req.sessionData.sessionId);

      res.json({
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Valida senha para acesso a cliente (Gate 2)
   */
  static async validateClientAccess(req: Request, res: Response): Promise<void> {
    try {
      const { password }: UnlockRequest = req.body;
      const clientId = req.params.clientId;

      if (!password) {
        res.status(400).json({
          error: 'MISSING_PASSWORD',
          message: 'Senha é obrigatória'
        });
        return;
      }

      if (!clientId) {
        res.status(400).json({
          error: 'MISSING_CLIENT_ID',
          message: 'ID do cliente é obrigatório'
        });
        return;
      }

      if (!req.workspace || !req.sessionData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Sessão inválida'
        });
        return;
      }

      if (!req.sessionData.unlocked) {
        res.status(423).json({
          error: 'WORKSPACE_LOCKED',
          message: 'Workspace deve estar desbloqueado primeiro'
        });
        return;
      }

      // Validar senha novamente (Gate 2)
      const tempWorkspace = await Workspace.findById(req.workspace.id!);
      if (!tempWorkspace) {
        res.status(404).json({
          error: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace não encontrado'
        });
        return;
      }

      const isValidPassword = await tempWorkspace.unlock(password);
      if (!isValidPassword) {
        res.status(401).json({
          error: 'INVALID_PASSWORD',
          message: 'Senha inválida'
        });
        return;
      }

      // TODO: Registrar log de acesso ao cliente (será implementado na FASE 4 com clientes reais)
      // await AuditLog.create(...);

      res.json({
        message: 'Acesso ao cliente autorizado',
        clientId: parseInt(clientId),
        accessGranted: true,
        validUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
      });
    } catch (error) {
      console.error('❌ Erro na validação de acesso ao cliente:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Altera senha do workspace
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Senha atual e nova senha são obrigatórias'
        });
        return;
      }

      if (!req.workspace || !req.sessionData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Sessão inválida'
        });
        return;
      }

      if (!req.sessionData.unlocked) {
        res.status(423).json({
          error: 'WORKSPACE_LOCKED',
          message: 'Workspace deve estar desbloqueado'
        });
        return;
      }

      // Validar força da nova senha
      const passwordStrength = CryptoService.validatePasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Nova senha muito fraca',
          suggestions: passwordStrength.suggestions
        });
        return;
      }

      // Alterar senha
      const success = await req.workspace.updatePassword(currentPassword, newPassword);
      if (!success) {
        res.status(401).json({
          error: 'INVALID_CURRENT_PASSWORD',
          message: 'Senha atual inválida'
        });
        return;
      }

      // Registrar log
      await AuditLog.create(
        req.workspace.id!,
        {
          action: AuditAction.WORKSPACE_PASSWORD_CHANGED,
          entity_type: EntityType.WORKSPACE,
          entity_id: req.workspace.id,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip || req.connection.remoteAddress
        },
        req.workspace
      );

      res.json({
        message: 'Senha alterada com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao alterar senha:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  }

  /**
   * Obtém informações da sessão atual
   */
  static async getSessionInfo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.workspace || !req.sessionData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Sessão inválida'
        });
        return;
      }

      res.json({
        workspace: req.workspace.toSafeObject(),
        session: {
          unlocked: req.sessionData.unlocked,
          lastActivity: new Date(req.sessionData.lastActivity).toISOString(),
          sessionId: req.sessionData.sessionId.substring(0, 8) + '...' // Apenas parte do ID por segurança
        }
      });
    } catch (error) {
      console.error('❌ Erro ao obter informações da sessão:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      });
    }
  }
}

export default AuthController;