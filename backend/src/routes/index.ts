import express from 'express';
import authRoutes from './auth';
import clientsRoutes from './clients';

const router = express.Router();

// Rotas de autenticação
router.use('/auth', authRoutes);

// Rotas de clientes
router.use('/clients', clientsRoutes);

// Rota de health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Backend do Sistema de Acessos Remotos funcionando',
    version: '2.0.0',
    phase: 'FASE_2_BACKEND_CORE'
  });
});

// Placeholder para outras rotas que serão implementadas nas próximas fases
router.use('/access-methods', (req, res) => {
  res.json({
    message: 'Métodos de acesso serão implementados na Fase 5',
    endpoint: req.originalUrl,
    method: req.method,
    phase: 'FASE_5_PENDING'
  });
});

router.use('/audit', (req, res) => {
  res.json({
    message: 'Auditoria será implementada na Fase 6',
    endpoint: req.originalUrl,
    method: req.method,
    phase: 'FASE_6_PENDING'
  });
});

// Rota para endpoints não encontrados
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'ENDPOINT_NOT_FOUND',
    message: 'Endpoint não encontrado',
    endpoint: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /api/health',
      'GET /api/auth/status',
      'POST /api/auth/setup',
      'POST /api/auth/login',
      'POST /api/auth/unlock',
      'POST /api/auth/lock',
      'POST /api/auth/logout',
      'POST /api/auth/validate-client/:clientId',
      'POST /api/auth/change-password',
      'GET /api/auth/session',
      'GET /api/clients (FASE_4)',
      'POST /api/clients (FASE_4)',
      'GET /api/clients/:id (FASE_4)',
      'PUT /api/clients/:id (FASE_4)',
      'DELETE /api/clients/:id (FASE_4)'
    ]
  });
});

export default router;