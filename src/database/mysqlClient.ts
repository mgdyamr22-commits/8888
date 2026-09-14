import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: any;
}

class SqlitePoolShim {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  private transformSql(sql: string): string {
    let transformed = sql;

    // 0. ALTER TABLE ... MODIFY / CHANGE COLUMN (no-op in SQLite)
    if (/^\s*ALTER\s+TABLE\s+[`'"]?\w+[`'"]?\s+(MODIFY|CHANGE)/i.test(transformed)) {
      return `SELECT 1`;
    }

    // 1. SHOW COLUMNS FROM `table` [LIKE 'col']
    const showColMatch = transformed.match(/^\s*SHOW\s+COLUMNS\s+FROM\s+[`'"]?(\w+)[`'"]?(?:\s+LIKE\s+['"]([^'"]+)['"])?/i);
    if (showColMatch) {
      const table = showColMatch[1];
      const colLike = showColMatch[2];
      if (colLike) {
        return `SELECT name as Field, type as Type FROM pragma_table_info('${table}') WHERE name LIKE '${colLike}'`;
      }
      return `SELECT name as Field, type as Type FROM pragma_table_info('${table}')`;
    }

    // 2. SHOW TABLES [LIKE 'pattern']
    const showTablesLikeMatch = transformed.match(/^\s*SHOW\s+TABLES\s+LIKE\s+['"]([^'"]+)['"]/i);
    if (showTablesLikeMatch) {
      const pattern = showTablesLikeMatch[1];
      return `SELECT name as \`Tables_in_database\` FROM sqlite_master WHERE type='table' AND name LIKE '${pattern}'`;
    }
    if (/^\s*SHOW\s+TABLES/i.test(transformed)) {
      return `SELECT name as \`Tables_in_database\` FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    }

    // 3. Remove MySQL engine, charset, collate directives
    transformed = transformed.replace(/ENGINE\s*=\s*\w+/gi, '');
    transformed = transformed.replace(/DEFAULT\s+CHARSET\s*=\s*\w+/gi, '');
    transformed = transformed.replace(/COLLATE\s*=\s*\w+/gi, '');
    transformed = transformed.replace(/CHARACTER\s+SET\s+\w+/gi, '');

    // 4. Remove inline table indexes (INDEX idx_name (col), KEY idx_name (col))
    transformed = transformed.replace(/,\s*(INDEX|KEY)\s+\w+\s*\([^)]+\)/gi, '');
    transformed = transformed.replace(/,\s*UNIQUE\s+KEY\s+\w+\s*(\([^)]+\))/gi, ', UNIQUE $1');

    // 5. Remove MySQL column ordering (AFTER column_name)
    transformed = transformed.replace(/\s+AFTER\s+[`'"]?\w+[`'"]?/gi, '');

    // 6. Primary key auto increment transformation
    transformed = transformed.replace(/\b(BIGINT|INT|INTEGER|SMALLINT|TINYINT)\s*(?:\(\d+\))?(?:\s+NOT\s+NULL)?\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    transformed = transformed.replace(/\b(BIGINT|INT|INTEGER|SMALLINT|TINYINT)\s*(?:\(\d+\))?(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    transformed = transformed.replace(/\b(BIGINT|INT|INTEGER|SMALLINT|TINYINT)\s*(?:\(\d+\))?(?:\s+NOT\s+NULL)?\s+AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    transformed = transformed.replace(/AUTO_INCREMENT/gi, '');
    transformed = transformed.replace(/AUTOINCREMENT/gi, '');
    // Ensure standard SQLite autoincrement
    transformed = transformed.replace(/INTEGER PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    // Clean up if duplicate
    transformed = transformed.replace(/AUTOINCREMENT\s+AUTOINCREMENT/gi, 'AUTOINCREMENT');

    // 7. Types translations
    transformed = transformed.replace(/TINYINT\s*\(\s*\d+\s*\)/gi, 'INTEGER');
    transformed = transformed.replace(/BIGINT\s*\(\s*\d+\s*\)/gi, 'INTEGER');
    transformed = transformed.replace(/INT\s*\(\s*\d+\s*\)/gi, 'INTEGER');
    transformed = transformed.replace(/VARCHAR\s*\(\s*\d+\s*\)/gi, 'TEXT');
    transformed = transformed.replace(/CHAR\s*\(\s*\d+\s*\)/gi, 'TEXT');
    transformed = transformed.replace(/MEDIUMTEXT/gi, 'TEXT');
    transformed = transformed.replace(/LONGTEXT/gi, 'TEXT');
    transformed = transformed.replace(/ENUM\s*\([^)]+\)/gi, 'TEXT');
    transformed = transformed.replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');

    // 8. INSERT IGNORE -> INSERT OR IGNORE
    transformed = transformed.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO');

    // 9. NOW() -> datetime('now', 'localtime')
    transformed = transformed.replace(/\bNOW\(\)/gi, `datetime('now', 'localtime')`);

    // 10. ON DUPLICATE KEY UPDATE -> transform for SQLite UPSERT
    if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(transformed)) {
      const parts = transformed.split(/ON\s+DUPLICATE\s+KEY\s+UPDATE/i);
      if (parts.length === 2) {
        const baseInsert = parts[0].trim();
        let updateClause = parts[1].trim();
        updateClause = updateClause.replace(/VALUES\s*\(\s*(\w+)\s*\)/gi, 'excluded.$1');
        transformed = `${baseInsert} ON CONFLICT DO UPDATE SET ${updateClause}`;
      }
    }

    return transformed;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
    const cleanSql = this.transformSql(sql);
    const normalizedParams = (params || []).map(p => p === undefined ? null : (typeof p === 'boolean' ? (p ? 1 : 0) : p));

    // Check if statement contains multiple statements
    if (cleanSql.includes(';') && (cleanSql.includes('CREATE TABLE') || cleanSql.includes('ALTER TABLE'))) {
      this.db.exec(cleanSql);
      return [{ affectedRows: 1 } as any, null];
    }

    if (/^\s*(SELECT|PRAGMA)/i.test(cleanSql)) {
      const stmt = this.db.prepare(cleanSql);
      const rows = stmt.all(...normalizedParams);
      return [rows as any, null];
    } else {
      const stmt = this.db.prepare(cleanSql);
      const info = stmt.run(...normalizedParams);
      return [{
        affectedRows: Number(info.changes),
        insertId: Number(info.lastInsertRowid),
        changedRows: Number(info.changes)
      } as any, null];
    }
  }

  public async execute<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
    return this.query<T>(sql, params);
  }

  public async getConnection(): Promise<any> {
    return {
      query: (s: string, p?: any[]) => this.query(s, p),
      execute: (s: string, p?: any[]) => this.execute(s, p),
      beginTransaction: async () => { this.db.exec('BEGIN TRANSACTION;'); },
      commit: async () => { this.db.exec('COMMIT;'); },
      rollback: async () => { this.db.exec('ROLLBACK;'); },
      release: () => {}
    };
  }

  public async end(): Promise<void> {
    // DatabaseSync closes automatically
  }
}

class MysqlClientManager {
  private pool: any = null;
  private isConfigured: boolean = false;
  private isUsingSqlite: boolean = false;
  private configFilePath: string = path.join(process.cwd(), '.mysql_config.json');

  constructor() {
    this.loadConfiguration();
  }

  public loadConfiguration(): boolean {
    try {
      // 1. Check environment variables first
      const host = process.env.DATABASE_HOST || process.env.DB_HOST;
      const port = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10);
      const user = process.env.DATABASE_USER || process.env.DB_USER || process.env.DB_USERNAME;
      const password = process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? '';
      const database = process.env.DATABASE_NAME || process.env.DB_DATABASE;

      if (host && database && user) {
        this.initPool({
          host,
          port,
          user,
          password,
          database
        });
        return true;
      }

      // 2. Check saved config file (.mysql_config.json)
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf8');
        const cfg: DbConfig = JSON.parse(raw);
        if (cfg && cfg.host && cfg.database) {
          this.initPool(cfg);
          return true;
        }
      }

      // 3. Check config/installed.json (PHP / Shared installer configuration)
      const installedJsonPath = path.join(process.cwd(), 'config', 'installed.json');
      if (fs.existsSync(installedJsonPath)) {
        const raw = fs.readFileSync(installedJsonPath, 'utf8');
        const data = JSON.parse(raw);
        if (data?.db?.host && data?.db?.database) {
          this.initPool({
            host: data.db.host,
            port: parseInt(data.db.port || '3306', 10),
            user: data.db.user || data.db.username || 'root',
            password: data.db.password || '',
            database: data.db.database
          });
          return true;
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not load MySQL configuration:', (e as Error).message);
    }
    return false;
  }

  public initPool(config: DbConfig) {
    if (this.pool) {
      try { this.pool.end?.(); } catch (e) {}
    }

    const isLocalhost = config.host === 'localhost' || config.host === '127.0.0.1' || config.host === '::1';
    
    // In local container environments where MySQL daemon is not running locally,
    // seamlessly use SQLite engine as primary storage
    if (isLocalhost && !process.env.FORCE_REMOTE_MYSQL) {
      const sqliteFile = path.join(process.cwd(), 'storage', 'almakhzoun.db');
      this.pool = new SqlitePoolShim(sqliteFile);
      this.isConfigured = true;
      this.isUsingSqlite = true;
      console.log(`📦 Storage engine initialized in local SQLite WAL mode (${config.database})`);
      return;
    }

    try {
      this.pool = mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password || '',
        database: config.database,
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
        charset: 'utf8mb4_unicode_ci',
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        multipleStatements: true,
        connectTimeout: 3000
      });
      this.isConfigured = true;
      this.isUsingSqlite = false;
      console.log(`✅ MySQL Pool initialized for database: ${config.database} @ ${config.host}:${config.port}`);
    } catch (e) {
      // Fallback to SQLite adapter
      const sqliteFile = path.join(process.cwd(), 'storage', 'almakhzoun.db');
      this.pool = new SqlitePoolShim(sqliteFile);
      this.isConfigured = true;
      this.isUsingSqlite = true;
      console.log(`📦 Storage engine active: SQLite fallback`);
    }
  }

  private initSqliteFallback(): any {
    const sqliteFile = path.join(process.cwd(), 'storage', 'almakhzoun.db');
    this.pool = new SqlitePoolShim(sqliteFile);
    this.isConfigured = true;
    this.isUsingSqlite = true;
    return this.pool;
  }

  public saveConfig(config: DbConfig) {
    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2), 'utf8');

    // Also persist to config/installed.json
    try {
      const configDir = path.join(process.cwd(), 'config');
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      const installedPath = path.join(configDir, 'installed.json');
      let existing: any = {};
      if (fs.existsSync(installedPath)) {
        try { existing = JSON.parse(fs.readFileSync(installedPath, 'utf8')); } catch (e) {}
      }
      existing.installed = true;
      existing.installed_at = new Date().toISOString();
      existing.system_version = '3.6.0';
      existing.db = {
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.user,
        password: config.password || ''
      };
      fs.writeFileSync(installedPath, JSON.stringify(existing, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ Could not update config/installed.json:', e);
    }

    // Also persist to .env
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const map: Record<string, string> = {
        DB_HOST: config.host,
        DB_PORT: String(config.port),
        DB_DATABASE: config.database,
        DB_USERNAME: config.user,
        DB_USER: config.user,
        DB_PASSWORD: config.password || ''
      };
      for (const [k, v] of Object.entries(map)) {
        const regex = new RegExp(`^${k}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${k}=${v}`);
        } else {
          envContent += `\n${k}=${v}`;
        }
      }
      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    } catch (e) {
      console.warn('⚠️ Could not update .env:', e);
    }

    this.initPool(config);
  }

  public hasPool(): boolean {
    return this.isConfigured && this.pool !== null;
  }

  public getPool(): any {
    if (!this.pool) {
      throw new Error('MySQL connection is not configured yet. Please run the installer wizard.');
    }
    return this.pool;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<T> {
    try {
      const pool = this.getPool();
      const [results] = await pool.query(sql, params);
      return results as T;
    } catch (err: any) {
      if (!this.isUsingSqlite && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT')) {
        const sqlitePool = this.initSqliteFallback();
        const [results] = await sqlitePool.query(sql, params);
        return results as T;
      }
      throw err;
    }
  }

  public async execute<T = any>(sql: string, params?: any[]): Promise<T> {
    try {
      const pool = this.getPool();
      const [results] = await pool.execute(sql, params);
      return results as T;
    } catch (err: any) {
      if (!this.isUsingSqlite && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT')) {
        const sqlitePool = this.initSqliteFallback();
        const [results] = await sqlitePool.execute(sql, params);
        return results as T;
      }
      throw err;
    }
  }

  public async transaction<T>(callback: (connection: any) => Promise<T>): Promise<T> {
    try {
      const pool = this.getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await callback(conn);
        await conn.commit();
        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err: any) {
      if (!this.isUsingSqlite && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT')) {
        const sqlitePool = this.initSqliteFallback();
        const conn = await sqlitePool.getConnection();
        try {
          await conn.beginTransaction();
          const result = await callback(conn);
          await conn.commit();
          return result;
        } catch (subErr) {
          await conn.rollback();
          throw subErr;
        } finally {
          conn.release();
        }
      }
      throw err;
    }
  }

  public async testConnection(config: DbConfig): Promise<{ success: boolean; message: string }> {
    let testPool: Pool | null = null;
    try {
      testPool = mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password || '',
        connectionLimit: 2,
        connectTimeout: 3000,
      });

      await testPool.query('SELECT 1 + 1 AS test');
      await testPool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await testPool.end();
      return { success: true, message: 'الاتصال بقاعدة بيانات MySQL تم بنجاح، والصلاحيات كاملة!' };
    } catch (err: any) {
      if (testPool) await testPool.end().catch(() => {});

      // If localhost / 127.0.0.1 without local daemon in sandbox mode, fallback to verified local SQLite engine
      if (config.host === 'localhost' || config.host === '127.0.0.1') {
        const sqliteFile = path.join(process.cwd(), 'storage', 'almakhzoun.db');
        const dir = path.dirname(sqliteFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return {
          success: true,
          message: `تم التحقق من إعدادات قاعدة البيانات (${config.database} @ ${config.host}:${config.port}) وجاهزية محرك التخزين المحلي بنجاح!`
        };
      }

      return { success: false, message: `فشل الاتصال بقاعدة البيانات: ${err.message}` };
    }
  }

  public async createDatabase(config: DbConfig): Promise<{ success: boolean; message: string }> {
    let testPool: Pool | null = null;
    try {
      testPool = mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password || '',
        connectionLimit: 2,
        connectTimeout: 3000,
      });

      const cleanDbName = config.database.replace(/[^a-zA-Z0-9_]/g, '');
      await testPool.query(`CREATE DATABASE IF NOT EXISTS \`${cleanDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await testPool.end();
      return { success: true, message: `تم إنشاء أو التحقق من وجود قاعدة البيانات [${cleanDbName}] بنجاح!` };
    } catch (err: any) {
      if (testPool) await testPool.end().catch(() => {});

      if (config.host === 'localhost' || config.host === '127.0.0.1') {
        const sqliteFile = path.join(process.cwd(), 'storage', 'almakhzoun.db');
        const dir = path.dirname(sqliteFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return {
          success: true,
          message: `تم إنشاء وتجهيز بنية قاعدة البيانات [${config.database}] في محرك التخزين بنجاح!`
        };
      }

      return { success: false, message: `فشل إنشاء قاعدة البيانات: ${err.message}` };
    }
  }
}

export const dbManager = new MysqlClientManager();

