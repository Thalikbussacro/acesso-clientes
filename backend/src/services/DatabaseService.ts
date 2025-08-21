import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

export interface DatabaseConfig {
  dbPath?: string;
  verbose?: boolean;
}

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(config: DatabaseConfig = {}) {
    this.dbPath = config.dbPath || path.join(__dirname, '../../../data/database_new.db');
    
    // Garantir que o diretório data existe
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (config.verbose) {
      sqlite3.verbose();
    }
  }

  /**
   * Conecta ao banco de dados SQLite
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Erro ao conectar ao banco:', err.message);
          reject(err);
        } else {
          console.log('📁 Conectado ao banco SQLite:', this.dbPath);
          // Habilitar foreign keys
          this.db!.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  /**
   * Executa uma query SELECT e retorna todos os resultados
   */
  async all<T = any>(query: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database não conectado'));
        return;
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('❌ Erro na query ALL:', err.message);
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * Executa uma query SELECT e retorna o primeiro resultado
   */
  async get<T = any>(query: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database não conectado'));
        return;
      }

      this.db.get(query, params, (err, row) => {
        if (err) {
          console.error('❌ Erro na query GET:', err.message);
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  /**
   * Executa uma query INSERT/UPDATE/DELETE
   */
  async run(query: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database não conectado'));
        return;
      }

      this.db.run(query, params, function(err) {
        if (err) {
          console.error('❌ Erro na query RUN:', err.message);
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  /**
   * Executa múltiplas queries em uma transação
   */
  async transaction(queries: Array<{ query: string; params?: any[] }>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database não conectado'));
        return;
      }

      this.db.serialize(() => {
        this.db!.run('BEGIN TRANSACTION');

        let hasError = false;
        let completed = 0;

        for (const { query, params = [] } of queries) {
          this.db!.run(query, params, (err) => {
            if (err && !hasError) {
              hasError = true;
              this.db!.run('ROLLBACK', () => {
                console.error('❌ Erro na transação, rollback executado:', err.message);
                reject(err);
              });
              return;
            }

            completed++;
            if (completed === queries.length && !hasError) {
              this.db!.run('COMMIT', (err) => {
                if (err) {
                  console.error('❌ Erro no commit:', err.message);
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  /**
   * Executa migrations para criar/atualizar schema
   */
  async runMigrations(): Promise<void> {
    console.log('🔄 Executando migrations...');

    const migrations = [
      // Tabela de versão das migrations
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tabela de Workspaces
      `CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        encryption_key_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tabela de Clientes
      `CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        notes_encrypted TEXT,
        search_index TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
      )`,

      // Tabela de Métodos de Acesso
      `CREATE TABLE IF NOT EXISTS access_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        method_type TEXT NOT NULL,
        method_name TEXT NOT NULL,
        fields_encrypted TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
      )`,

      // Tabela de Logs de Auditoria
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        client_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        details_encrypted TEXT,
        details_public TEXT,
        user_agent TEXT,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL
      )`,

      // Tabela de Configurações de Tipos de Método
      `CREATE TABLE IF NOT EXISTS method_type_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        method_type TEXT NOT NULL,
        field_definitions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
        UNIQUE(workspace_id, method_type)
      )`,

      // Índices para performance
      `CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)`,
      `CREATE INDEX IF NOT EXISTS idx_clients_search_index ON clients(search_index)`,
      `CREATE INDEX IF NOT EXISTS idx_access_methods_client_id ON access_methods(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`
    ];

    try {
      for (const migration of migrations) {
        await this.run(migration);
      }
      
      // Registrar versão da migration
      await this.run(
        'INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)',
        [1]
      );
      
      console.log('✅ Migrations executadas com sucesso');
    } catch (error) {
      console.error('❌ Erro ao executar migrations:', error);
      throw error;
    }
  }

  /**
   * Verifica se o workspace existe
   */
  async hasWorkspace(): Promise<boolean> {
    const result = await this.get('SELECT COUNT(*) as count FROM workspaces');
    return result?.count > 0;
  }

  /**
   * Fecha a conexão com o banco
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          console.error('❌ Erro ao fechar banco:', err.message);
          reject(err);
        } else {
          console.log('🔒 Conexão com banco fechada');
          this.db = null;
          resolve();
        }
      });
    });
  }

  /**
   * Getter para verificar se está conectado
   */
  get isConnected(): boolean {
    return this.db !== null;
  }
}

// Instância singleton
export const databaseService = new DatabaseService({ verbose: false });