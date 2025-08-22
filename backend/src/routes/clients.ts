import express from 'express';
import { 
  validateSession, 
  requireUnlockedWorkspace,
  auditLog 
} from '../middleware/auth';
import { AuditAction, EntityType } from '../models/AuditLog';
import { ClientController } from '../controllers/ClientController';

const router = express.Router();

/**
 * @route GET /api/clients/count
 * @description Conta total de clientes
 * @access Private (requer workspace desbloqueado)
 */
router.get('/count', 
  validateSession, 
  requireUnlockedWorkspace,
  ClientController.getClientsCount
);

/**
 * @route GET /api/clients
 * @description Lista clientes com paginação e busca
 * @access Private (requer workspace desbloqueado)
 */
router.get('/', 
  validateSession, 
  requireUnlockedWorkspace,
  ClientController.getClients
);

/**
 * @route POST /api/clients
 * @description Cria novo cliente
 * @access Private (requer workspace desbloqueado)
 */
router.post('/', 
  validateSession, 
  requireUnlockedWorkspace,
  ClientController.createClient
);

/**
 * @route GET /api/clients/:id
 * @description Busca cliente por ID
 * @access Private (requer validação Gate 2)
 */
router.get('/:id', 
  validateSession, 
  requireUnlockedWorkspace,
  ClientController.getClient
);

/**
 * @route PUT /api/clients/:id
 * @description Atualiza cliente
 * @access Private (requer validação Gate 2)
 */
router.put('/:id', 
  validateSession, 
  requireUnlockedWorkspace,
  ClientController.updateClient
);

/**
 * @route DELETE /api/clients/:id
 * @description Deleta cliente
 * @access Private (requer validação Gate 2)
 */
router.delete('/:id', 
  validateSession, 
  requireUnlockedWorkspace,
  ClientController.deleteClient
);

export default router;