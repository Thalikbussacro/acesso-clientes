import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { databaseService } from './services/DatabaseService';
import apiRoutes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de segurança
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Permitir embeds para rich text editor
}));

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // Frontend Vite (múltiplas portas)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // máximo 200 requests por IP (aumentado para desenvolvimento)
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Muitas requisições. Tente novamente em 15 minutos.'
  }
});
app.use('/api', limiter);

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging de requests (desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Rotas da API
app.use('/api', apiRoutes);

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    name: 'Sistema de Gerenciamento de Acessos Remotos',
    version: '2.0.0',
    phase: 'FASE_2_BACKEND_CORE',
    status: 'OK',
    docs: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Middleware de tratamento de erros
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Erro no servidor:', err.stack);
  
  // Não expor detalhes do erro em produção
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: isDevelopment ? err.message : 'Erro interno do servidor',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'ROUTE_NOT_FOUND',
    message: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
    suggestion: 'Verifique a documentação da API em /api/health'
  });
});

// Função para inicializar o servidor
async function startServer() {
  try {
    console.log('🔄 Inicializando Sistema de Acessos Remotos...');
    
    // Conectar ao banco de dados
    console.log('📁 Conectando ao banco de dados...');
    await databaseService.connect();
    
    // Executar migrations
    console.log('🔄 Executando migrations...');
    await databaseService.runMigrations();
    
    // Verificar status do workspace
    const hasWorkspace = await databaseService.hasWorkspace();
    console.log(`🏢 Workspace configurado: ${hasWorkspace ? 'SIM' : 'NÃO'}`);
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('🚀 Sistema iniciado com sucesso!');
      console.log(`📍 Servidor: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Status: http://localhost:${PORT}/api/auth/status`);
      console.log(`⚙️  Fase atual: FASE 2 - Backend Core e Segurança`);
      
      if (!hasWorkspace) {
        console.log('📝 Configure o workspace em: POST /api/auth/setup');
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

// Função para shutdown graceful
async function gracefulShutdown() {
  console.log('🔄 Iniciando shutdown graceful...');
  
  try {
    await databaseService.close();
    console.log('✅ Banco de dados desconectado');
  } catch (error) {
    console.error('❌ Erro ao fechar banco:', error);
  }
  
  process.exit(0);
}

// Handlers para shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Inicializar servidor
startServer();

export default app;