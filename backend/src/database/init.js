const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho para o banco de dados
const dbPath = path.join(__dirname, '../../../data/database.db');

// Criar conexão com o banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco de dados:', err.message);
    return;
  }
  console.log('📁 Conectado ao banco SQLite:', dbPath);
});

// Schema inicial conforme especificação
const createTables = () => {
  // Tabela de Workspaces (bases/espaços de trabalho)
  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela workspaces:', err.message);
    else console.log('✅ Tabela workspaces criada');
  });

  // Tabela de Clientes
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      notes_encrypted TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela clients:', err.message);
    else console.log('✅ Tabela clients criada');
  });

  // Tabela de Métodos de Acesso
  db.run(`
    CREATE TABLE IF NOT EXISTS access_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      method_type TEXT NOT NULL,
      method_name TEXT NOT NULL,
      fields_encrypted TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela access_methods:', err.message);
    else console.log('✅ Tabela access_methods criada');
  });

  // Tabela de Logs de Auditoria
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      client_id INTEGER,
      action TEXT NOT NULL,
      details_encrypted TEXT,
      user_agent TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela audit_logs:', err.message);
    else console.log('✅ Tabela audit_logs criada');
  });

  // Tabela de Configurações de Tipos de Método
  db.run(`
    CREATE TABLE IF NOT EXISTS method_type_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      method_type TEXT NOT NULL,
      field_definitions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
      UNIQUE(workspace_id, method_type)
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela method_type_configs:', err.message);
    else console.log('✅ Tabela method_type_configs criada');
  });
};

// Executar criação das tabelas
createTables();

// Fechar conexão após um tempo
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Erro ao fechar banco:', err.message);
    } else {
      console.log('🔒 Conexão com banco fechada');
    }
  });
}, 1000);