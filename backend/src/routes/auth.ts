import express from 'express';
import AuthController from '../controllers/AuthController';
import { 
  requireWorkspace, 
  validateSession, 
  requireUnlockedWorkspace 
} from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/auth/status
 * @description Verifica status do sistema
 * @access Public
 */
router.get('/status', AuthController.getStatus);

/**
 * @route POST /api/auth/setup
 * @description Cria workspace inicial (primeiro uso)
 * @access Public (apenas se não existe workspace)
 */
router.post('/setup', AuthController.createWorkspace);

/**
 * @route POST /api/auth/login
 * @description Login inicial (cria sessão)
 * @access Public (requer workspace configurado)
 */
router.post('/login', requireWorkspace, AuthController.login);

/**
 * @route POST /api/auth/unlock
 * @description Desbloqueia workspace (Gate 1)
 * @access Private (requer sessão válida)
 */
router.post('/unlock', validateSession, AuthController.unlockWorkspace);

/**
 * @route POST /api/auth/lock
 * @description Bloqueia workspace
 * @access Private (requer sessão válida)
 */
router.post('/lock', validateSession, AuthController.lockWorkspace);

/**
 * @route POST /api/auth/logout
 * @description Logout (destrói sessão)
 * @access Private (requer sessão válida)
 */
router.post('/logout', validateSession, AuthController.logout);

/**
 * @route POST /api/auth/validate-client/:clientId
 * @description Valida acesso a cliente específico (Gate 2)
 * @access Private (requer workspace desbloqueado)
 */
router.post('/validate-client/:clientId', 
  validateSession, 
  requireUnlockedWorkspace, 
  AuthController.validateClientAccess
);

/**
 * @route POST /api/auth/change-password
 * @description Altera senha do workspace
 * @access Private (requer workspace desbloqueado)
 */
router.post('/change-password', 
  validateSession, 
  requireUnlockedWorkspace, 
  AuthController.changePassword
);

/**
 * @route GET /api/auth/session
 * @description Obtém informações da sessão atual
 * @access Private (requer sessão válida)
 */
router.get('/session', validateSession, AuthController.getSessionInfo);

export default router;