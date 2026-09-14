import path from 'path';
import fs from 'fs';
import os from 'os';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Server-side SMTP Password encryption using AES-256-CBC
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.from(
  process.env.SERVER_ENCRYPTION_KEY || '8c79f9f82d1c6ebd0f24950fa2b98e1e127bf9bd5a8b2dfa0cb9c87f65e23b12',
  'hex'
);
const IV_LENGTH = 16;

export function encryptAES(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption AES error:', error);
    return text;
  }
}

export function decryptAES(text: string): string {
  try {
    if (!text || !text.includes(':')) return text;
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn('AES Decryption warning (might be plaintext or corrupted):', error);
    return text;
  }
}

// Determine the writeable data directory
let dbDir: string;
try {
  const { app } = require('electron');
  dbDir = app.getPath('userData');
} catch (e) {
  const home = os.homedir() || os.tmpdir();
  dbDir = path.join(home, '.almakhzoun_inventory_pro_data');
}

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  // Test write permission
  const testFile = path.join(dbDir, '.write_test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
} catch (err) {
  const fallbackDir = path.join(os.tmpdir(), '.almakhzoun_inventory_pro_data');
  console.warn(`⚠️ Primary DB directory [${dbDir}] is not writeable, falling back to ${fallbackDir}:`, err);
  dbDir = fallbackDir;
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export const DB_PATH = path.join(dbDir, 'almakhzoun_inventory_pro_database.json');

// Automatic data migration from older generic paths if they exist
try {
  const oldHomeDir = path.join(os.homedir() || os.tmpdir(), '.myapp_data');
  const oldDbPath = path.join(oldHomeDir, 'app_database.json');
  if (!fs.existsSync(DB_PATH) && fs.existsSync(oldDbPath)) {
    console.log(`🚚 Old database detected at: ${oldDbPath}. Migrating content safely...`);
    fs.copyFileSync(oldDbPath, DB_PATH);
    console.log(`✅ Safe migration of old database successfully completed!`);
  }
} catch (migErr) {
  console.error('Failed to migrate database from legacy paths:', migErr);
}

console.log(`🗄️ JSON Database location auto-resolved to: ${DB_PATH}`);

interface DbSchema {
  users: any[];
  otpLogs: any[];
  logHistory: any[];
  companies: any[];
}

class JsonDatabase {
  private path: string;
  private data: DbSchema;

  constructor(filePath: string, callback?: (err: Error | null) => void) {
    this.path = filePath;
    this.data = { users: [], otpLogs: [], logHistory: [], companies: [] };
    this.load();
    setTimeout(() => {
      if (callback) callback(null);
    }, 50);
  }

  private load() {
    try {
      if (fs.existsSync(this.path)) {
        const fileContent = fs.readFileSync(this.path, 'utf8');
        this.data = JSON.parse(fileContent);
        if (!Array.isArray(this.data.users)) this.data.users = [];
        if (!Array.isArray(this.data.otpLogs)) this.data.otpLogs = [];
        if (!Array.isArray(this.data.logHistory)) this.data.logHistory = [];
        if (!Array.isArray(this.data.companies)) this.data.companies = [];
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading JSON database:', err);
      this.data = { users: [], otpLogs: [], logHistory: [], companies: [] };
      this.save();
    }
  }

  private save() {
    try {
      const tempPath = this.path + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.path);
    } catch (err) {
      console.error('Error saving JSON database atomically:', err);
    }
  }

  serialize(callback: () => void) {
    callback();
  }

  get(sql: string, params: any[] | any = [], callback?: (err: Error | null, row?: any) => void) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const cb = callback || (() => {});

    try {
      const query = sql.trim().replace(/\s+/g, ' ').toUpperCase();

      // COUNT Users
      if (query.includes('SELECT COUNT(*) AS COUNT FROM USERS')) {
        return cb(null, { count: this.data.users.length });
      }

      // COUNT Users
      if (query.includes('SELECT COUNT(*) AS COUNT FROM USERS') || query.includes('SELECT COUNT(*) FROM USERS')) {
        return cb(null, { count: this.data.users.length });
      }

      // COUNT Companies
      if (query.includes('SELECT COUNT(*) AS COUNT FROM COMPANIES') || query.includes('SELECT COUNT(*) FROM COMPANIES')) {
        return cb(null, { count: this.data.companies.length });
      }

      // SELECT * FROM Users WHERE id = ?
      if (query.includes('SELECT * FROM USERS WHERE ID = ?') || query.includes('FROM USERS WHERE ID = ?')) {
        const id = String(params[0] || '').trim();
        const user = this.data.users.find(u => String(u.id).trim() === id);
        return cb(null, user ? { ...user } : null);
      }

      // SELECT * FROM Users WHERE username = ?
      if (query.includes('FROM USERS WHERE USERNAME = ?')) {
        const username = String(params[0] || '').toLowerCase().trim();
        const user = this.data.users.find(u => (u.username || '').toLowerCase().trim() === username);
        return cb(null, user ? { ...user } : null);
      }

      // SELECT * FROM Companies WHERE id = ?
      if (query.includes('SELECT * FROM COMPANIES WHERE ID = ?') || query.includes('FROM COMPANIES WHERE ID = ?')) {
        const id = String(params[0] || '').trim();
        const company = this.data.companies.find(c => String(c.id).trim() === id);
        return cb(null, company ? { ...company } : null);
      }

      // SELECT * FROM OTP_Logs WHERE userId = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1
      if (query.includes('FROM OTP_LOGS WHERE USERID =') && query.includes("STATUS = 'PENDING'")) {
        const userId = params[0];
        const pendingLogs = this.data.otpLogs.filter(log => log.userId === userId && log.status === 'PENDING');
        if (pendingLogs.length === 0) {
          return cb(null, null);
        }
        const sorted = [...pendingLogs].sort((a, b) => b.id - a.id);
        return cb(null, sorted[0]);
      }

      console.warn(`[JSON DB GET] Unrecognized query: "${sql}"`, params);
      cb(null, null);
    } catch (err: any) {
      cb(err);
    }
  }

  all(sql: string, params: any[] | any = [], callback?: (err: Error | null, rows?: any[]) => void) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const cb = callback || (() => {});

    try {
      const query = sql.trim().replace(/\s+/g, ' ').toUpperCase();

      // SELECT * FROM Companies
      if (query.includes('SELECT * FROM COMPANIES') || query.includes('FROM COMPANIES')) {
        return cb(null, [...this.data.companies]);
      }

      // SELECT * FROM Users
      if (query.includes('FROM USERS') && !query.includes('COUNT(')) {
        const companyId = params[0] ? String(params[0]).trim() : null;
        let filteredUsers = this.data.users;
        if (companyId) {
          filteredUsers = this.data.users.filter(u => 
            !u.companyId || 
            String(u.companyId).trim() === companyId || 
            u.role === 'ADMIN' || 
            u.primaryAdmin === 1 || 
            u.primaryAdmin === true
          );
        }
        // Return cloned full objects preserving all fields
        const mappedUsers = filteredUsers.map(u => ({ ...u }));
        return cb(null, mappedUsers);
      }

      // SELECT createdAt FROM OTP_Logs WHERE userId = ? AND createdAt >= ?
      if (query.includes('FROM OTP_LOGS WHERE USERID =') && query.includes('CREATEDAT >= ?')) {
        const userId = params[0];
        const limitDateStr = params[1];
        const filtered = this.data.otpLogs.filter(log => {
          return log.userId === userId && log.createdAt >= limitDateStr;
        });
        return cb(null, filtered);
      }

      console.warn(`[JSON DB ALL] Unrecognized query: "${sql}"`, params);
      cb(null, []);
    } catch (err: any) {
      cb(err);
    }
  }

  run(sql: string, params: any[] | any = [], callback?: (err: Error | null) => void) {
    let actualParams = params;
    let cb = callback;
    if (typeof params === 'function') {
      cb = params;
      actualParams = [];
    }
    const finalCb = cb || (() => {});

    try {
      const query = sql.trim().replace(/\s+/g, ' ').toUpperCase();

      if (query.startsWith('CREATE TABLE')) {
        return finalCb(null);
      }

      // UPDATE OTP_Logs SET status = 'EXPIRED' WHERE userId = ? AND status = 'PENDING'
      if (query.includes("UPDATE OTP_LOGS SET STATUS = 'EXPIRED'") && query.includes('STATUS = PENDING')) {
        const userId = actualParams[0];
        this.data.otpLogs.forEach(log => {
          if (log.userId === userId && log.status === 'PENDING') {
            log.status = 'EXPIRED';
          }
        });
        this.save();
        return finalCb(null);
      }

      // UPDATE OTP_Logs SET status = 'EXPIRED' WHERE id = ?
      if (query.includes("UPDATE OTP_LOGS SET STATUS = 'EXPIRED' WHERE ID = ?")) {
        const id = actualParams[0];
        const log = this.data.otpLogs.find(l => l.id === id);
        if (log) log.status = 'EXPIRED';
        this.save();
        return finalCb(null);
      }

      // UPDATE OTP_Logs SET status = 'FAILED_MAX_ATTEMPTS' WHERE id = ?
      if (query.includes("UPDATE OTP_LOGS SET STATUS = 'FAILED_MAX_ATTEMPTS' WHERE ID = ?")) {
        const id = actualParams[0];
        const log = this.data.otpLogs.find(l => l.id === id);
        if (log) log.status = 'FAILED_MAX_ATTEMPTS';
        this.save();
        return finalCb(null);
      }

      // UPDATE OTP_Logs SET attempts = ?, status = 'FAILED_MAX_ATTEMPTS' WHERE id = ?
      if (query.includes("UPDATE OTP_LOGS SET ATTEMPTS = ?, STATUS = 'FAILED_MAX_ATTEMPTS'")) {
        const attempts = actualParams[0];
        const id = actualParams[1];
        const log = this.data.otpLogs.find(l => l.id === id);
        if (log) {
          log.attempts = attempts;
          log.status = 'FAILED_MAX_ATTEMPTS';
        }
        this.save();
        return finalCb(null);
      }

      // UPDATE OTP_Logs SET attempts = ? WHERE id = ?
      if (query.includes('UPDATE OTP_LOGS SET ATTEMPTS = ? WHERE ID = ?')) {
        const attempts = actualParams[0];
        const id = actualParams[1];
        const log = this.data.otpLogs.find(l => l.id === id);
        if (log) log.attempts = attempts;
        this.save();
        return finalCb(null);
      }

      // UPDATE OTP_Logs SET status = 'VERIFIED' WHERE id = ?
      if (query.includes("UPDATE OTP_LOGS SET STATUS = 'VERIFIED' WHERE ID = ?")) {
        const id = actualParams[0];
        const log = this.data.otpLogs.find(l => l.id === id);
        if (log) log.status = 'VERIFIED';
        this.save();
        return finalCb(null);
      }

      // UPDATE Users SET password = ? WHERE id = ?
      if (query.includes('UPDATE USERS SET PASSWORD = ? WHERE ID = ?')) {
        const passwordHash = actualParams[0];
        const id = actualParams[1];
        const user = this.data.users.find(u => u.id === id);
        if (user) {
          user.password = passwordHash;
          user.plainPassword = ''; // Ensure security
        }
        this.save();
        return finalCb(null);
      }

      // INSERT INTO OTP_Logs
      if (query.startsWith('INSERT INTO OTP_LOGS')) {
        const [userId, otpHash, createdAt, expiresAt, ipAddress] = actualParams;
        const newId = this.data.otpLogs.length > 0 ? Math.max(...this.data.otpLogs.map(l => l.id)) + 1 : 1;
        this.data.otpLogs.push({
          id: newId,
          userId,
          otpHash,
          createdAt,
          expiresAt,
          attempts: 0,
          ipAddress,
          status: 'PENDING'
        });
        this.save();
        return finalCb(null);
      }

      // INSERT INTO Log_History
      if (query.startsWith('INSERT INTO LOG_HISTORY')) {
        const [userId, action, details, ipAddress] = actualParams;
        const newId = this.data.logHistory.length > 0 ? Math.max(...this.data.logHistory.map(l => l.id)) + 1 : 1;
        this.data.logHistory.push({
          id: newId,
          userId,
          action,
          details,
          ipAddress,
          createdAt: new Date().toISOString()
        });
        this.save();
        return finalCb(null);
      }

      // INSERT INTO Companies
      if (query.startsWith('INSERT INTO COMPANIES')) {
        const [companyName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassEncrypted, senderEmail, logo, createdAt] = actualParams;
        const newId = 'c_' + String(this.data.companies.length > 0 ? Math.max(...this.data.companies.map(c => parseInt(c.id.split('_')[1] || '0', 10))) + 1 : 1);
        
        const companyObj = {
          id: newId,
          companyName,
          smtpHost,
          smtpPort: parseInt(smtpPort, 10),
          smtpSecure: Number(smtpSecure) === 1 || smtpSecure === true,
          smtpUser,
          smtpPassEncrypted,
          senderEmail,
          logo,
          createdAt: createdAt || new Date().toISOString()
        };
        this.data.companies.push(companyObj);
        this.save();
        // Invoke callback with 'this' context bound for lastID matching
        finalCb.call({ lastID: newId } as any, null);
        return;
      }

      // UPDATE Companies SET companyName = ?, smtpHost = ?, smtpPort = ?, smtpSecure = ?, smtpUser = ?, smtpPassEncrypted = ?, senderEmail = ?, logo = ?, stampUrl = ? WHERE id = ?
      if (query.startsWith('UPDATE COMPANIES')) {
        let companyName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassEncrypted, senderEmail, logo, stampUrl, id;
        if (actualParams.length >= 10) {
          [companyName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassEncrypted, senderEmail, logo, stampUrl, id] = actualParams;
        } else {
          [companyName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassEncrypted, senderEmail, logo, id] = actualParams;
          stampUrl = undefined;
        }
        const company = this.data.companies.find(c => String(c.id) === String(id));
        if (company) {
          company.companyName = companyName;
          company.smtpHost = smtpHost;
          company.smtpPort = parseInt(smtpPort, 10);
          company.smtpSecure = Number(smtpSecure) === 1 || smtpSecure === true;
          company.smtpUser = smtpUser;
          company.smtpPassEncrypted = smtpPassEncrypted;
          company.senderEmail = senderEmail;
          company.logo = logo;
          if (stampUrl !== undefined) {
            company.stampUrl = stampUrl;
          }
        }
        this.save();
        return finalCb(null);
      }

      console.warn(`[JSON DB RUN] Unrecognized query: "${sql}"`, actualParams);
      finalCb(null);
    } catch (err: any) {
      finalCb(err);
    }
  }

  // SQLite API compatibility: prepare statement (used during user seeding)
  prepare(sql: string, callback?: (err: Error | null) => void) {
    const self = this;
    return {
      run(...args: any[]) {
        let params = args;
        let cb = () => {};
        if (typeof args[args.length - 1] === 'function') {
          cb = args.pop();
        }
        
        try {
          const query = sql.trim().replace(/\s+/g, ' ').toUpperCase();
          if (query.startsWith('INSERT INTO USERS')) {
            const [id, username, password, role, adminEmail, primaryAdmin, companyId] = params;
            // Avoid duplicate seeding
            if (!self.data.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
              self.data.users.push({
                id,
                username,
                password,
                role,
                adminEmail,
                primaryAdmin,
                companyId: companyId || 'c1',
                createdAt: new Date().toISOString()
              });
              self.save();
            }
          }
          cb();
        } catch (err) {
          console.error('[JSON DB PREPARE RUN] Error:', err);
        }
      },
      finalize(callback?: (err: Error | null) => void) {
        if (callback) callback(null);
      }
    };
  }

  close(callback?: (err: Error | null) => void) {
    if (callback) callback(null);
  }

  // Custom helper for raw updates
  getRawData() {
    return this.data;
  }

  replaceDatabase(newData: DbSchema) {
    this.data = newData;
    this.save();
  }

  rawSave() {
    this.save();
  }
}

// Instantiate database with the JsonDatabase emulator
export const db = new JsonDatabase(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Failed to open JSON database:', err.message);
  } else {
    console.log('✅ Port-Free JSON Database successfully loaded under secure fallback.');
    seedUsersAndCompanies();
  }
});

function seedUsersAndCompanies() {
  db.get('SELECT COUNT(*) as count FROM Companies', [], (err, row: any) => {
    if (err) return console.error('Error checking company counts:', err.message);
    
    // Seed default company c1 first if none exists
    if (!row || row.count === 0) {
      console.log('🌱 Seeding initial organization table inside the SQLite virtual database...');
      const defaultCompany = {
        id: 'c1',
        companyName: 'المخزون الذكي لتجارة السيارات',
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'makhzoun.smtp.outlook@outlook.com',
        // Encrypt of "YourStrongPasswordHere" fallback
        smtpPassEncrypted: encryptAES('YourStrongPasswordHere'),
        senderEmail: 'makhzoun.smtp.outlook@outlook.com',
        logo: '',
        createdAt: new Date().toISOString()
      };
      
      const raw = db.getRawData();
      raw.companies.push(defaultCompany);
      db.rawSave();
      console.log('🌱 Default tenant auto-linked successfully.');
    }

    // Seed initial users ONLY if users collection is completely empty (first time install)
    const raw = db.getRawData();
    if (!raw.users || raw.users.length === 0) {
      console.log('🌱 Seeding initial application administrator credentials...');
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('admin', salt);

      raw.users = [
        {
          id: 'u1',
          username: 'admin',
          password: hashedPassword,
          role: 'ADMIN',
          adminEmail: 'admin@alforsancar.com',
          primaryAdmin: 1,
          companyId: 'c1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'u2',
          username: 'user',
          password: hashedPassword,
          role: 'EMPLOYEE',
          adminEmail: 'admin@alforsancar.com',
          primaryAdmin: 0,
          companyId: 'c1',
          createdAt: new Date().toISOString()
        }
      ];

      db.rawSave();
      console.log('🌱 Seed complete. Single application administrator active.');
    }
  });
}
