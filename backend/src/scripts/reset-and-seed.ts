import { databaseService } from '../services/DatabaseService';
import Workspace from '../models/Workspace';
import Client from '../models/Client';
import AuditLog from '../models/AuditLog';

/**
 * Script para resetar o banco de dados e criar dados de teste
 * 
 * USO: npm run reset-seed
 */
async function resetAndSeed() {
  console.log('🔄 Iniciando reset e seed do banco de dados...');

  try {
    // Conectar ao banco
    await databaseService.connect();
    console.log('✅ Conectado ao banco de dados');

    // Limpar dados existentes
    console.log('🗑️ Limpando dados existentes...');
    await databaseService.run('DELETE FROM audit_logs');
    await databaseService.run('DELETE FROM access_methods');
    await databaseService.run('DELETE FROM clients');
    await databaseService.run('DELETE FROM workspaces');
    await databaseService.run('DELETE FROM schema_migrations');
    console.log('✅ Dados existentes removidos');

    // Executar migrations para garantir schema atualizado
    console.log('🔄 Executando migrations...');
    await databaseService.runMigrations();
    console.log('✅ Schema atualizado');

    // Criar workspace de teste
    console.log('👤 Criando workspace de teste...');
    const workspace = await Workspace.create({
      name: 'SoAutomacao',
      password: '@Mrpolado36'
    });
    console.log('✅ Workspace criado:', workspace.name);

    // Desbloquear workspace para operações
    console.log('🔓 Desbloqueando workspace...');
    const unlocked = await workspace.unlock('@Mrpolado36');
    if (!unlocked) {
      throw new Error('Falha ao desbloquear workspace');
    }
    console.log('✅ Workspace desbloqueado');

    // Criar clientes de teste
    console.log('👥 Criando clientes de teste...');
    
    const clientsData = [
      {
        name: 'Empresa ABC Ltda',
        notes: `
          <h2>Informações Importantes</h2>
          <p><strong>Responsável:</strong> João Silva</p>
          <p><strong>Telefone:</strong> (11) 9999-8888</p>
          <ul>
            <li>Acesso liberado das 8h às 18h</li>
            <li>Backup automático às 23h</li>
            <li>Sistema crítico - contatar antes de reiniciar</li>
          </ul>
          <p style="color: red;"><strong>ATENÇÃO:</strong> Nunca desligar o servidor principal!</p>
        `
      },
      {
        name: 'Consultório Dr. Maria',
        notes: `
          <h2>Sistema Médico</h2>
          <p><strong>Software:</strong> ClinicaSoft Pro</p>
          <p><strong>Banco:</strong> PostgreSQL</p>
          <h3>Horários de Manutenção:</h3>
          <ul>
            <li>Segunda: 12h às 13h</li>
            <li>Quinta: 18h às 19h</li>
          </ul>
          <p><em>Sistema protegido por LGPD - dados sensíveis!</em></p>
        `
      },
      {
        name: 'Loja Tech Solutions',
        notes: `
          <h2>E-commerce</h2>
          <p><strong>Plataforma:</strong> Magento</p>
          <p><strong>Hosting:</strong> AWS</p>
          <h3>Configurações:</h3>
          <ol>
            <li>SSL renovado automaticamente</li>
            <li>CDN CloudFlare ativo</li>
            <li>Backup diário no S3</li>
          </ol>
          <blockquote>
            <p>"Vendas Black Friday - performance crítica em novembro!"</p>
          </blockquote>
        `
      },
      {
        name: 'Escritório Advocacia & Cia',
        notes: `
          <h2>Sistema Jurídico</h2>
          <p><strong>Advogado Principal:</strong> Dr. Roberto Santos</p>
          <table border="1" style="border-collapse: collapse; width: 100%;">
            <tr>
              <th>Dia</th>
              <th>Horário</th>
              <th>Responsável</th>
            </tr>
            <tr>
              <td>Segunda-feira</td>
              <td>9h-17h</td>
              <td>Ana (secretária)</td>
            </tr>
            <tr>
              <td>Terça-feira</td>
              <td>8h-16h</td>
              <td>Carlos (estagiário)</td>
            </tr>
          </table>
        `
      },
      {
        name: 'Restaurante Bella Vista',
        notes: `
          <h2>Sistema POS</h2>
          <p><strong>Software:</strong> iFood + SiS Restaurante</p>
          <p>Dados de acesso ao sistema de pedidos online integrado com delivery.</p>
          <h3>Observações:</h3>
          <ul>
            <li style="color: green;">✅ Sistema funcionando perfeitamente</li>
            <li style="color: orange;">⚠️ Atualização pendente para próxima semana</li>
            <li style="color: blue;">💡 Considerar migração para novo POS</li>
          </ul>
        `
      }
    ];

    for (const clientData of clientsData) {
      const client = await Client.create(workspace.id!, {
        name: clientData.name,
        notes: clientData.notes
      }, workspace);
      
      console.log(`✅ Cliente criado: ${client.name}`);
    }

    // Criar log de auditoria para demonstrar o sistema
    await AuditLog.create(workspace.id!, {
      action: 'SYSTEM_SEED',
      entity_type: 'DATABASE',
      publicDetails: {
        message: 'Sistema resetado e populado com dados de teste',
        clients_created: clientsData.length,
        timestamp: new Date().toISOString()
      }
    }, workspace);

    console.log('📊 Log de auditoria criado');

    console.log('🎉 Reset e seed concluídos com sucesso!');
    console.log('');
    console.log('📋 Resumo:');
    console.log(`   • Workspace: ${workspace.name}`);
    console.log(`   • Senha: @Mrpolado36`);
    console.log(`   • Clientes: ${clientsData.length}`);
    console.log(`   • Criptografia: AES-256-GCM ✅`);
    console.log('');
    console.log('🚀 Agora você pode testar o sistema com:');
    console.log('   npm run dev');

  } catch (error) {
    console.error('❌ Erro durante reset e seed:', error);
    process.exit(1);
  } finally {
    // Fechar conexão
    await databaseService.close();
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  resetAndSeed();
}

export default resetAndSeed;