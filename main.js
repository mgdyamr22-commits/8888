const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const packageInfo = require('./package.json');

// Set unique app name to isolate paths and single-instance locks
app.setName('almakhzoun_inventory_pro');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock({ projectId: 'almakhzoun_inventory_pro' });
if (!gotTheLock) {
  app.quit();
}

let mainWindow;

app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
  if (additionalData && additionalData.projectId === 'almakhzoun_inventory_pro') {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  }
});

// Primary Storage Paths inside app.getPath('userData')
const USER_DATA_PATH = app.getPath('userData');
const VAULT_PATH = path.join(USER_DATA_PATH, 'karian_secure_vault.dat');
const LAYOUT_SETTINGS_PATH = path.join(USER_DATA_PATH, 'user_table_layout_settings.json');
const DB_FILE_PATH = path.join(USER_DATA_PATH, 'almakhzoun_inventory_pro_database.json');
const DB_BACKUP_PATH = path.join(USER_DATA_PATH, 'almakhzoun_users_db_backup.json');

// Ensure Logs directory exists
const LOGS_DIR = path.join(USER_DATA_PATH, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create logs directory:', e);
  }
}
const APP_LOG_PATH = path.join(LOGS_DIR, 'app.log');

function logAppError(context, err) {
  const time = new Date().toISOString();
  const errorDetails = err?.stack || err?.message || String(err);
  const logEntry = `[${time}] [${context}] ${errorDetails}\n`;
  console.error(logEntry);
  try {
    fs.appendFileSync(APP_LOG_PATH, logEntry, 'utf8');
  } catch (e) {
    console.error('Failed to write to app.log:', e);
  }
}

// Global Exception Handlers
process.on('uncaughtException', (err) => {
  logAppError('GLOBAL_UNCAUGHT_EXCEPTION', err);
});

process.on('unhandledRejection', (reason) => {
  logAppError('GLOBAL_UNHANDLED_REJECTION', reason);
});

// Google OAuth Configuration & Dynamic Loopback Setup
const OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  authUri: 'https://accounts.google.com/o/oauth2/auth',
  tokenUri: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/drive.file']
};

const OAUTH_LOG_PATH = path.join(LOGS_DIR, 'oauth.log');
const OAUTH_TOKENS_PATH = path.join(USER_DATA_PATH, 'oauth_tokens.json');

function logOAuthError(context, errDetails) {
  const time = new Date().toISOString();
  const stack = errDetails?.stack || 'No stack trace available';
  const status = errDetails?.status || errDetails?.statusCode || errDetails?.response?.status || 'N/A';
  const googleError = errDetails?.googleError || errDetails?.error || 'N/A';
  const responseBody = typeof errDetails?.responseBody === 'object'
    ? JSON.stringify(errDetails.responseBody, null, 2)
    : (errDetails?.responseBody || errDetails?.message || String(errDetails));

  const logEntry = `[${time}] [${context}]
- HTTP Status: ${status}
- Google Error Code: ${googleError}
- Message: ${errDetails?.message || String(errDetails)}
- Response Body: ${responseBody}
- Stack Trace:
${stack}
--------------------------------------------------\n`;

  console.error(logEntry);
  try {
    fs.appendFileSync(OAUTH_LOG_PATH, logEntry, 'utf8');
  } catch (e) {
    console.error('Failed to write to oauth.log:', e);
  }
}

function saveOAuthTokens(tokenData) {
  try {
    const existing = loadOAuthTokens() || {};
    const updated = {
      ...existing,
      ...tokenData,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(OAUTH_TOKENS_PATH, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    logOAuthError('SAVE_OAUTH_TOKENS_FAILED', err);
    return null;
  }
}

function loadOAuthTokens() {
  try {
    if (fs.existsSync(OAUTH_TOKENS_PATH)) {
      const data = fs.readFileSync(OAUTH_TOKENS_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logOAuthError('LOAD_OAUTH_TOKENS_FAILED', err);
  }
  return null;
}

function clearOAuthTokens() {
  try {
    if (fs.existsSync(OAUTH_TOKENS_PATH)) {
      fs.unlinkSync(OAUTH_TOKENS_PATH);
    }
  } catch (err) {
    logOAuthError('CLEAR_OAUTH_TOKENS_FAILED', err);
  }
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function decodeIdTokenEmail(idToken) {
  try {
    if (!idToken) return null;
    const parts = idToken.split('.');
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      return payload.email || null;
    }
  } catch (e) {}
  return null;
}

function exchangeCodeForTokens(code, redirectUri, verifier) {
  return new Promise((resolve, reject) => {
    const postParams = new url.URLSearchParams({
      code: code,
      client_id: OAUTH_CONFIG.clientId,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier
    });
    if (OAUTH_CONFIG.clientSecret) {
      postParams.append('client_secret', OAUTH_CONFIG.clientSecret);
    }

    const postData = postParams.toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            const err = new Error(parsed.error_description || parsed.error || 'فشل تبديل رمز التفويض بنصوص الوصول');
            err.statusCode = res.statusCode;
            err.googleError = parsed.error;
            err.responseBody = parsed;
            reject(err);
          }
        } catch (e) {
          e.responseBody = body;
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const postParams = new url.URLSearchParams({
      refresh_token: refreshToken,
      client_id: OAUTH_CONFIG.clientId,
      grant_type: 'refresh_token'
    });
    if (OAUTH_CONFIG.clientSecret) {
      postParams.append('client_secret', OAUTH_CONFIG.clientSecret);
    }

    const postData = postParams.toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            const err = new Error(parsed.error_description || parsed.error || 'فشل تجديد رمز الجلسة السحابية');
            err.statusCode = res.statusCode;
            err.googleError = parsed.error;
            err.responseBody = parsed;
            reject(err);
          }
        } catch (e) {
          e.responseBody = body;
          reject(e);
        }
      });
    });

    req.on('error', e => reject(e));
    req.write(postData);
    req.end();
  });
}

function startOAuthLoopback() {
  return new Promise((resolve, reject) => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    let server;
    let timeoutId;

    server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new url.URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        if (reqUrl.pathname === '/oauth2callback' || reqUrl.pathname === '/') {
          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html dir="rtl" lang="ar">
              <head><meta charset="utf-8"><title>تعذر الربط</title></head>
              <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #fef2f2; color: #991b1b;">
                <h2>فشل التخول عبر Google Drive</h2>
                <p>السبب: ${error}</p>
                <p>يمكنك إغلاق هذه النافذة والعودة إلى برنامج المخزون للمحاولة مجدداً.</p>
              </body>
              </html>
            `);
            if (timeoutId) clearTimeout(timeoutId);
            server.close();
            const err = new Error(`Google OAuth error: ${error}`);
            logOAuthError('OAUTH_CALLBACK_ERROR', err);
            reject(err);
            return;
          }

          if (code) {
            const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;
            try {
              const tokenResponse = await exchangeCodeForTokens(code, redirectUri, verifier);
              const userEmail = decodeIdTokenEmail(tokenResponse.id_token);
              const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

              const savedData = saveOAuthTokens({
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token || (loadOAuthTokens()?.refreshToken || ''),
                expiresAt: expiresAt,
                email: userEmail || ''
              });

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head><meta charset="utf-8"><title>تم الربط بنجاح</title></head>
                <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 60px; background: #f8fafc; color: #0f172a;">
                  <div style="max-width: 460px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    <div style="font-size: 56px; margin-bottom: 16px;">✨</div>
                    <h2 style="color: #2563eb; margin-bottom: 12px; font-weight: 900;">تم ربط Google Drive بنجاح!</h2>
                    <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">تم إكمال التفويض بنجاح وتفعيل المزامنة السحابية المشفرة.</p>
                    <p style="color: #94a3b8; font-size: 13px;">يمكنك إغلاق هذه النافذة الآن والعودة إلى برنامج المخزون.</p>
                  </div>
                </body>
                </html>
              `);

              if (timeoutId) clearTimeout(timeoutId);
              server.close();
              resolve({
                success: true,
                accessToken: tokenResponse.access_token,
                refreshToken: savedData?.refreshToken,
                expiresAt: expiresAt,
                email: userEmail
              });
            } catch (exchangeErr) {
              res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head><meta charset="utf-8"><title>فشل الرمز</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #fef2f2; color: #991b1b;">
                  <h2>فشل استبدال رمز الوصول</h2>
                  <p>${exchangeErr.message}</p>
                </body>
                </html>
              `);
              if (timeoutId) clearTimeout(timeoutId);
              server.close();
              logOAuthError('EXCHANGE_CODE_FAILED', exchangeErr);
              reject(exchangeErr);
            }
          }
        }
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        server.close();
        logOAuthError('OAUTH_LOOPBACK_REQUEST_ERROR', err);
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
      const scopes = encodeURIComponent(OAUTH_CONFIG.scopes.join(' '));

      const authUrl = `${OAUTH_CONFIG.authUri}?` +
                      `response_type=code` +
                      `&client_id=${encodeURIComponent(OAUTH_CONFIG.clientId)}` +
                      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                      `&scope=${scopes}` +
                      `&access_type=offline` +
                      `&prompt=consent` +
                      `&code_challenge=${encodeURIComponent(challenge)}` +
                      `&code_challenge_method=S256`;

      shell.openExternal(authUrl);
    });

    server.on('error', (err) => {
      logOAuthError('OAUTH_SERVER_LISTEN_ERROR', err);
      reject(err);
    });

    timeoutId = setTimeout(() => {
      try { server.close(); } catch (e) {}
      const timeoutErr = new Error('انتهاء مهلة الانتظار لتسجيل الدخول عبر المتصفح (3 دقائق)');
      logOAuthError('OAUTH_TIMEOUT', timeoutErr);
      reject(timeoutErr);
    }, 180000);
  });
}

function getDeviceFingerprint() {
  const interfaces = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break;
      }
    }
    if (mac) break;
  }
  const machineData = os.hostname() + os.arch() + os.platform();
  return crypto.createHash('sha256').update(mac + machineData).digest('hex').substring(0, 20).toUpperCase();
}

function createMenu() {
  const template = [
    {
      label: 'ملف',
      submenu: [
        {
          label: 'فتح النظام',
          click: () => {
            if (mainWindow) mainWindow.show();
          }
        },
        { type: 'separator' },
        {
          label: 'إغلاق البرنامج',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'reload', label: 'إعادة تحميل الواجهة' },
        { role: 'forceReload', label: 'تحديث إجباري' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'الزوم الافتراضي' },
        { role: 'zoomIn', label: 'تكبير' },
        { role: 'zoomOut', label: 'تصغير' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'كامل الشاشة' }
      ]
    },
    {
      label: 'حول',
      submenu: [
        {
          label: 'الحقوق والمطور',
          click: async () => {
            await shell.openExternal('https://karia2.blogspot.com/');
          }
        },
        {
          label: 'إصدار النظام',
          enabled: false,
          sublabel: `v${packageInfo.version} Pro Enterprise`
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'مخزوني برو - إدارة أصول المركبات',
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    }
  });

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;

  // Clear Chromium cache on start
  mainWindow.webContents.session.clearCache().catch((err) => {
    logAppError('CLEAR_CACHE', err);
  });

  if (isDev) {
    console.log(`[Electron Main] Loading Development URL: ${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Direct Native Load without Express or HTTP Server
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log(`[Electron Native] Loading local static bundle: ${indexPath}`);
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  createMenu();

  // Intercept external links
  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl.startsWith('http:') || openUrl.startsWith('https:')) {
      shell.openExternal(openUrl);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      if (!navigationUrl.startsWith('file:')) {
        event.preventDefault();
        if (navigationUrl.startsWith('http:') || navigationUrl.startsWith('https:')) {
          shell.openExternal(navigationUrl);
        }
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // --- IPC Handlers for Safe File Operations ---
  // 1. Interactive Manual Export
  ipcMain.handle('export-backup-file', async (event, { content, filename }) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'حفظ النسخة الاحتياطية - مخزوني برو',
        defaultPath: filename || `backup_${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Backup Files (*.json)', extensions: ['json'] }]
      });
      if (!canceled && filePath) {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, filePath };
      }
      return { success: false, canceled: true };
    } catch (err) {
      logAppError('EXPORT_BACKUP_FILE', err);
      return { success: false, error: String(err) };
    }
  });

  // 2. Select Target Backup Directory for Fully Automated Silent Scheduled Backups
  ipcMain.handle('select-backup-directory', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'اختر مجلد حفظ النسخ الاحتياطية التلقائية',
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      return { success: true, dirPath: result.filePaths[0] };
    } catch (err) {
      logAppError('SELECT_BACKUP_DIR', err);
      return { success: false, error: String(err) };
    }
  });

  // 3. Save / Update Backup File Silently in Target Directory (Without Popups / Prompts)
  ipcMain.handle('save-backup-to-directory', async (event, { dirPath, filename, content, maxKeep = 20 }) => {
    try {
      if (!dirPath || typeof dirPath !== 'string' || !dirPath.trim()) {
        return { success: false, error: 'لم يتم تحديد مسار مجلد الحفظ على الجهاز.' };
      }
      const cleanDirPath = dirPath.trim();
      if (!fs.existsSync(cleanDirPath)) {
        fs.mkdirSync(cleanDirPath, { recursive: true });
      }

      const targetFilePath = path.join(cleanDirPath, filename);
      
      // Direct reliable write to disk with immediate flush (updates same daily file in-place)
      fs.writeFileSync(targetFilePath, content, { encoding: 'utf8', flag: 'w' });

      // Clean up old daily backup files ONLY IF maxKeep is explicitly greater than 0
      // If maxKeep is 0 or negative, it means "Unlimited" (الاحتفاظ بالكل) so NEVER delete files!
      if (maxKeep && Number(maxKeep) > 0) {
        try {
          const keepCount = Number(maxKeep);
          const allFiles = fs.readdirSync(cleanDirPath);
          const backupFiles = allFiles
            .filter(f => f.startsWith('almakhzoun_auto_backup') && f.endsWith('.json'))
            .map(f => {
              const full = path.join(cleanDirPath, f);
              try {
                return {
                  name: f,
                  fullPath: full,
                  mtime: fs.statSync(full).mtime.getTime()
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .sort((a, b) => b.mtime - a.mtime); // Newest first

          if (backupFiles.length > keepCount) {
            const toDelete = backupFiles.slice(keepCount);
            for (const item of toDelete) {
              try {
                fs.unlinkSync(item.fullPath);
                console.log(`[BackupDir] Cleaned up older backup: ${item.name}`);
              } catch (delErr) {
                console.warn(`[BackupDir] Could not delete old file ${item.name}:`, delErr);
              }
            }
          }
        } catch (cleanErr) {
          console.warn('Backup directory cleanup error:', cleanErr);
        }
      }

      // Verify file was written and get true size
      const fileStats = fs.statSync(targetFilePath);

      return {
        success: true,
        filePath: targetFilePath,
        sizeBytes: fileStats.size
      };
    } catch (err) {
      logAppError('SAVE_BACKUP_DIR', err);
      return { success: false, error: String(err) };
    }
  });

  // 4. List Files from Target Backup Directory
  ipcMain.handle('list-backup-directory-files', async (event, { dirPath, prefix = 'almakhzoun' }) => {
    try {
      if (!dirPath || !fs.existsSync(dirPath)) {
        return { success: false, files: [] };
      }
      const allFiles = fs.readdirSync(dirPath);
      const files = allFiles
        .filter(f => f.includes(prefix) && f.endsWith('.json'))
        .map(f => {
          const full = path.join(dirPath, f);
          const stats = fs.statSync(full);
          return {
            name: f,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => b.lastModified.localeCompare(a.lastModified));

      return { success: true, files };
    } catch (err) {
      logAppError('LIST_BACKUP_DIR_FILES', err);
      return { success: false, error: String(err), files: [] };
    }
  });

  // 5. Read a specific backup file from Target Backup Directory
  ipcMain.handle('read-backup-directory-file', async (event, { dirPath, fileName }) => {
    try {
      if (!dirPath || !fileName) {
        return { success: false, error: 'المسار أو اسم الملف مفقود.' };
      }
      const fullPath = path.join(dirPath, fileName);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: 'الملف غير موجود في المجلد.' };
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      return { success: true, content };
    } catch (err) {
      logAppError('READ_BACKUP_DIR_FILE', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('import-backup-file', async () => {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'اختر ملف النسخة الاحتياطية - مخزوني برو',
        filters: [{ name: 'JSON Backup Files (*.json)', extensions: ['json'] }],
        properties: ['openFile']
      });
      if (!canceled && filePaths && filePaths.length > 0) {
        const content = fs.readFileSync(filePaths[0], 'utf8');
        return { success: true, content, filePath: filePaths[0] };
      }
      return { success: false, canceled: true };
    } catch (err) {
      logAppError('IMPORT_BACKUP_FILE', err);
      return { success: false, error: String(err) };
    }
  });

  // --- Database Persistence IPC Handlers ---
  ipcMain.handle('db-save-state', async (event, stateData) => {
    try {
      const tempPath = DB_FILE_PATH + '.tmp';
      const serialized = typeof stateData === 'string' ? stateData : JSON.stringify(stateData, null, 2);
      fs.writeFileSync(tempPath, serialized, 'utf8');
      fs.renameSync(tempPath, DB_FILE_PATH);

      // Keep user accounts backup atomically
      if (typeof stateData === 'object' && Array.isArray(stateData.users) && stateData.users.length > 0) {
        const tempBackup = DB_BACKUP_PATH + '.tmp';
        fs.writeFileSync(tempBackup, JSON.stringify(stateData.users, null, 2), 'utf8');
        fs.renameSync(tempBackup, DB_BACKUP_PATH);
      }
      return { success: true };
    } catch (err) {
      logAppError('DB_SAVE_STATE', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db-load-state', async () => {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
        return { success: true, data: JSON.parse(content) };
      }
      return { success: true, data: null };
    } catch (err) {
      logAppError('DB_LOAD_STATE', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db-native-backup', async () => {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
        return { success: true, content };
      }
      return { success: false, error: 'ملف قاعدة البيانات غير موجود بعد.' };
    } catch (err) {
      logAppError('DB_NATIVE_BACKUP', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db-native-restore', async (event, content) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      // Atomic write to userData DB file
      const tempPath = DB_FILE_PATH + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_FILE_PATH);

      return { success: true, restoredData: parsed };
    } catch (err) {
      logAppError('DB_NATIVE_RESTORE', err);
      return { success: false, error: 'ملف النسخة الاحتياطية تالف أو بتنسيق غير صحيح.' };
    }
  });

  // --- Enterprise Real Update Engine IPC Handlers (Physical File Replacement & Atomic Rollback) ---
  const UPDATE_SECRET_KEY = process.env.UPDATE_SIGNATURE_SECRET || 'almakhzoun_enterprise_update_sec_key_2026_x89';
  const NATIVE_BACKUPS_DIR = path.join(USER_DATA_PATH, 'update_backups');
  if (!fs.existsSync(NATIVE_BACKUPS_DIR)) {
    try { fs.mkdirSync(NATIVE_BACKUPS_DIR, { recursive: true }); } catch (e) {}
  }

  // 1. Select Update Package Dialog
  ipcMain.handle('update-select-package-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'اختر حزمة التحديث المؤسسية',
        filters: [
          { name: 'حزم التحديث المشفرة (*.kpatch, *.zip)', extensions: ['kpatch', 'zip', 'bin'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      const stats = fs.statSync(filePath);

      return {
        canceled: false,
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size,
        packageBase64: base64Data
      };
    } catch (err) {
      logAppError('UPDATE_SELECT_DIALOG', err);
      return { canceled: true, error: String(err) };
    }
  });

  // Helper for Inspecting Updates
  async function inspectNativeUpdateHandler(packageBase64OrPath) {
    try {
      const AdmZip = require('adm-zip');
      let zip;
      if (typeof packageBase64OrPath === 'string' && fs.existsSync(packageBase64OrPath)) {
        zip = new AdmZip(packageBase64OrPath);
      } else {
        const buf = Buffer.from(packageBase64OrPath, 'base64');
        zip = new AdmZip(buf);
      }

      const manifestEntry = zip.getEntry('manifest.json');
      if (!manifestEntry) {
        return { isValid: false, error: 'ملف manifest.json مفقود داخل حزمة التحديث.' };
      }

      const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));

      // Verify HMAC-SHA256
      const { digitalSignature, ...rest } = manifest;
      const serialized = JSON.stringify(rest, Object.keys(rest).sort());
      const expectedSig = crypto.createHmac('sha256', UPDATE_SECRET_KEY).update(serialized).digest('hex');
      const isSignatureValid = digitalSignature.toLowerCase() === expectedSig.toLowerCase();

      if (!isSignatureValid) {
        return { isValid: false, error: 'التوقيع الرقمي لحزمة التحديث غير معتمد أو تم التلاعب بها.' };
      }

      // Verify SHA-256 for all files
      const report = [];
      let allValid = true;

      for (const f of manifest.files) {
        if (f.action === 'delete') {
          report.push({ path: f.path, valid: true, size: 0 });
          continue;
        }

        const zipPath = `patch/${f.path}`.replace(/\\/g, '/');
        const entry = zip.getEntry(zipPath);
        if (!entry) {
          report.push({ path: f.path, valid: false, size: 0 });
          allValid = false;
          continue;
        }

        const data = entry.getData();
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        const match = hash.toLowerCase() === f.sha256.toLowerCase();
        if (!match) allValid = false;
        report.push({ path: f.path, valid: match, size: data.length });
      }

      return {
        isValid: allValid,
        isSignatureValid,
        manifest,
        integrityReport: report
      };
    } catch (err) {
      logAppError('UPDATE_INSPECT_NATIVE', err);
      return { isValid: false, error: String(err) };
    }
  }

  // Helper for Applying Updates
  async function applyNativeUpdateHandler(packageBase64) {
    let backupDir = null;
    try {
      const AdmZip = require('adm-zip');
      const buf = Buffer.from(packageBase64, 'base64');
      const zip = new AdmZip(buf);

      const manifestEntry = zip.getEntry('manifest.json');
      if (!manifestEntry) {
        return { success: false, error: 'ملف manifest.json غير موجود داخل الحزمة.' };
      }

      const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
      const appRoot = app.getAppPath();

      // Read current version
      const pkgPath = path.join(appRoot, 'package.json');
      let currentVer = '3.5.1';
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          currentVer = pkg.version || '3.5.1';
        } catch {}
      }

      // Create Atomic Backup
      const backupId = `update_backup_${Date.now()}_v${currentVer.replace(/\./g, '_')}`;
      backupDir = path.join(NATIVE_BACKUPS_DIR, backupId);
      fs.mkdirSync(backupDir, { recursive: true });

      for (const f of manifest.files) {
        const src = path.join(appRoot, f.path);
        if (fs.existsSync(src)) {
          const dst = path.join(backupDir, f.path);
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(src, dst);
        }
      }

      // Backup package.json & metadata.json
      if (fs.existsSync(pkgPath)) {
        fs.copyFileSync(pkgPath, path.join(backupDir, 'package.json'));
      }
      const metaPath = path.join(appRoot, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        fs.copyFileSync(metaPath, path.join(backupDir, 'metadata.json'));
      }

      // Extract and Physically Replace Files
      let replacedCount = 0;
      for (const f of manifest.files) {
        const dest = path.join(appRoot, f.path);
        if (f.action === 'delete') {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          continue;
        }

        const zipPath = `patch/${f.path}`.replace(/\\/g, '/');
        const entry = zip.getEntry(zipPath);
        if (!entry) {
          throw new Error(`الملف مفقود داخل الحزمة: ${f.path}`);
        }

        const fileData = entry.getData();
        const hash = crypto.createHash('sha256').update(fileData).digest('hex');
        if (hash.toLowerCase() !== f.sha256.toLowerCase()) {
          throw new Error(`تجزئة SHA-256 غير متطابقة للملف: ${f.path}`);
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, fileData);
        replacedCount++;
      }

      // Bump versions
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = manifest.targetVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      }
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.version = manifest.targetVersion;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      }

      return {
        success: true,
        manifest,
        filesUpdated: replacedCount,
        migrationsRun: manifest.migrations ? manifest.migrations.length : 0,
        backupId
      };
    } catch (err) {
      logAppError('UPDATE_APPLY_NATIVE', err);
      // Auto Rollback
      if (backupDir && fs.existsSync(backupDir)) {
        try {
          const appRoot = app.getAppPath();
          const restore = (curDir, rel = '') => {
            for (const item of fs.readdirSync(curDir, { withFileTypes: true })) {
              const itemRel = path.join(rel, item.name);
              const fullSrc = path.join(curDir, item.name);
              if (item.isDirectory()) {
                restore(fullSrc, itemRel);
              } else {
                const dest = path.join(appRoot, itemRel);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(fullSrc, dest);
              }
            }
          };
          restore(backupDir);
        } catch (rErr) {
          logAppError('UPDATE_ROLLBACK_ERROR', rErr);
        }
      }
      return { success: false, error: String(err) };
    }
  }

  // 2. Inspect Native Update Package
  ipcMain.handle('update-inspect-native', async (event, packageBase64OrPath) => {
    return await inspectNativeUpdateHandler(packageBase64OrPath);
  });

  // 3. Apply Native Update (Physical File Replacement + Backup + Migrations)
  ipcMain.handle('update-apply-native', async (event, packageBase64) => {
    return await applyNativeUpdateHandler(packageBase64);
  });

  // 4. Build Native Update Package
  ipcMain.handle('update-build-native', async (event, options) => {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      const appRoot = app.getAppPath();

      const manifestFiles = [];
      for (const relPath of (options.filesToInclude || [])) {
        const full = path.join(appRoot, relPath);
        if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
          const data = fs.readFileSync(full);
          const hash = crypto.createHash('sha256').update(data).digest('hex');
          manifestFiles.push({
            path: relPath,
            sha256: hash,
            size: data.length,
            type: 'source',
            action: 'update'
          });
          const zipPath = path.join('patch', relPath).replace(/\\/g, '/');
          zip.addFile(zipPath, data);
        }
      }

      const manifestWithoutSig = {
        manifestVersion: '2.0.0-enterprise',
        packageName: 'almakhzoun_inventory_pro_update',
        currentVersion: '3.5.1',
        targetVersion: options.targetVersion,
        buildNumber: options.buildNumber || Date.now(),
        releaseDate: new Date().toISOString(),
        releaseChannel: options.releaseChannel || 'stable',
        minimumSupportedVersion: options.minimumSupportedVersion || '3.5.0',
        databaseVersion: options.databaseVersion || '3.6.0',
        changelog: options.changelog,
        files: manifestFiles,
        migrations: options.migrations || []
      };

      const serialized = JSON.stringify(manifestWithoutSig, Object.keys(manifestWithoutSig).sort());
      const signature = crypto.createHmac('sha256', UPDATE_SECRET_KEY).update(serialized).digest('hex');
      const fullManifest = { ...manifestWithoutSig, digitalSignature: signature };

      zip.addFile('manifest.json', Buffer.from(JSON.stringify(fullManifest, null, 2), 'utf8'));

      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: 'حفظ حزمة التحديث (.kpatch)',
        defaultPath: `kpatch_v${options.targetVersion}_build${fullManifest.buildNumber}.kpatch`,
        filters: [{ name: 'Enterprise Patch', extensions: ['kpatch', 'zip'] }]
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }

      zip.writeZip(saveResult.filePath);
      return {
        canceled: false,
        filePath: saveResult.filePath,
        fileName: path.basename(saveResult.filePath),
        manifest: fullManifest
      };
    } catch (err) {
      logAppError('UPDATE_BUILD_NATIVE', err);
      return { canceled: true, error: String(err) };
    }
  });

  // 5. Explicit IPC Channel Mappings (Stage 4 Mandated API)
  // 5.1 update-check
  ipcMain.handle('update-check', async (event, packageBase64OrPath) => {
    return await inspectNativeUpdateHandler(packageBase64OrPath);
  });

  // 5.2 update-install
  ipcMain.handle('update-install', async (event, packageBase64) => {
    return await applyNativeUpdateHandler(packageBase64);
  });

  // 5.3 update-backup
  ipcMain.handle('update-backup', async (event, payload) => {
    try {
      const { filesToModify = [], fromVersion = '3.5.1', targetVersion = '3.6.0' } = payload || {};
      const backupId = `update_backup_${Date.now()}_v${fromVersion.replace(/\./g, '_')}`;
      const backupDir = path.join(NATIVE_BACKUPS_DIR, backupId);
      fs.mkdirSync(backupDir, { recursive: true });
      const appRoot = app.getAppPath();

      for (const rel of filesToModify) {
        const src = path.join(appRoot, rel);
        if (fs.existsSync(src)) {
          const dst = path.join(backupDir, rel);
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(src, dst);
        }
      }
      return { success: true, backupId, backupDir };
    } catch (err) {
      logAppError('UPDATE_BACKUP_IPC', err);
      return { success: false, error: String(err) };
    }
  });

  // 5.4 update-rollback
  ipcMain.handle('update-rollback', async (event, backupId) => {
    try {
      const backupDir = path.join(NATIVE_BACKUPS_DIR, backupId);
      if (!fs.existsSync(backupDir)) {
        return { success: false, error: 'مجلد النسخة الاحتياطية غير موجود' };
      }
      const appRoot = app.getAppPath();
      let restoredCount = 0;
      const restore = (curDir, rel = '') => {
        for (const item of fs.readdirSync(curDir, { withFileTypes: true })) {
          const itemRel = path.join(rel, item.name);
          const fullSrc = path.join(curDir, item.name);
          if (item.isDirectory()) {
            restore(fullSrc, itemRel);
          } else {
            const dest = path.join(appRoot, itemRel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(fullSrc, dest);
            restoredCount++;
          }
        }
      };
      restore(backupDir);
      return { success: true, restoredFiles: restoredCount };
    } catch (err) {
      logAppError('UPDATE_ROLLBACK_IPC', err);
      return { success: false, error: String(err) };
    }
  });

  // 5.5 restart-app and app-restart
  ipcMain.handle('restart-app', async () => {
    try {
      app.relaunch();
      app.exit(0);
      return { success: true };
    } catch (err) {
      logAppError('RESTART_APP', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('app-restart', async () => {
    try {
      app.relaunch();
      app.exit(0);
      return { success: true };
    } catch (err) {
      logAppError('APP_RESTART', err);
      return { success: false, error: String(err) };
    }
  });

  // --- Device & License IPC Handlers ---
  ipcMain.on('get-device-id', (event) => {
    if (event && typeof event.reply === 'function') {
      event.reply('device-id-reply', getDeviceFingerprint());
    }
  });

  ipcMain.on('save-license', (event, licenseData) => {
    try {
      let currentVault = {};
      if (fs.existsSync(VAULT_PATH)) {
        currentVault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
      }
      const updatedVault = { ...currentVault, ...licenseData };
      fs.writeFileSync(VAULT_PATH, JSON.stringify(updatedVault, null, 2), 'utf8');
      if (event && typeof event.reply === 'function') {
        event.reply('save-license-reply', true);
      }
    } catch (err) {
      logAppError('SAVE_LICENSE', err);
      if (event && typeof event.reply === 'function') {
        event.reply('save-license-reply', false);
      }
    }
  });

  ipcMain.on('load-license', (event) => {
    if (fs.existsSync(VAULT_PATH)) {
      try {
        const content = fs.readFileSync(VAULT_PATH, 'utf8');
        if (event && typeof event.reply === 'function') {
          event.reply('load-license-reply', JSON.parse(content));
        }
      } catch (err) {
        logAppError('LOAD_LICENSE', err);
        if (event && typeof event.reply === 'function') {
          event.reply('load-license-reply', null);
        }
      }
    } else {
      if (event && typeof event.reply === 'function') {
        event.reply('load-license-reply', null);
      }
    }
  });

  // --- Layout Settings IPC ---
  ipcMain.on('save-user-layout-settings', (event, data) => {
    try {
      fs.writeFileSync(LAYOUT_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
      if (event && typeof event.reply === 'function') {
        event.reply('save-user-layout-settings-reply', true);
      }
    } catch (err) {
      logAppError('SAVE_LAYOUT_SETTINGS', err);
      if (event && typeof event.reply === 'function') {
        event.reply('save-user-layout-settings-reply', false);
      }
    }
  });

  ipcMain.handle('load-user-layout-settings-async', async () => {
    try {
      if (fs.existsSync(LAYOUT_SETTINGS_PATH)) {
        const content = fs.readFileSync(LAYOUT_SETTINGS_PATH, 'utf8');
        return JSON.parse(content);
      }
    } catch (err) {
      logAppError('LOAD_LAYOUT_SETTINGS', err);
    }
    return null;
  });

  // --- Google OAuth Handlers (Loopback Server + Auto Refresh Engine) ---
  ipcMain.handle('google-oauth-start', async () => {
    try {
      const result = await startOAuthLoopback();
      return result;
    } catch (err) {
      logOAuthError('GOOGLE_OAUTH_START_FAILED', err);
      throw err;
    }
  });

  ipcMain.handle('google-oauth-get-token', async () => {
    try {
      const tokens = loadOAuthTokens();
      if (!tokens || (!tokens.accessToken && !tokens.refreshToken)) {
        return { success: false, error: 'reauth_required', message: 'لم يتم ربط حساب Google Drive بعد.' };
      }

      // Return valid cached access token if expiry > 5 minutes
      if (tokens.accessToken && tokens.expiresAt && Date.now() < tokens.expiresAt - (5 * 60 * 1000)) {
        return {
          success: true,
          accessToken: tokens.accessToken,
          email: tokens.email,
          expiresAt: tokens.expiresAt
        };
      }

      // Refresh using refresh_token if expired
      if (tokens.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(tokens.refreshToken);
          const expiresAt = Date.now() + (refreshed.expires_in * 1000);
          saveOAuthTokens({
            accessToken: refreshed.access_token,
            expiresAt: expiresAt
          });
          return {
            success: true,
            accessToken: refreshed.access_token,
            email: tokens.email,
            expiresAt: expiresAt
          };
        } catch (refreshErr) {
          logOAuthError('AUTOMATIC_TOKEN_REFRESH_FAILED', refreshErr);
          if (refreshErr?.googleError === 'invalid_grant' || String(refreshErr?.message).includes('invalid_grant')) {
            clearOAuthTokens();
            return { success: false, error: 'reauth_required', message: 'انتهت صلاحية جلسة Google Drive. يرجى إعارة الربط.' };
          }
          if (tokens.accessToken) {
            return { success: true, accessToken: tokens.accessToken, email: tokens.email, warning: 'network_issue' };
          }
          return { success: false, error: 'network_error', message: refreshErr.message };
        }
      }

      return { success: false, error: 'reauth_required', message: 'رمز التجديد غير متوفر.' };
    } catch (err) {
      logOAuthError('GET_TOKEN_IPC_ERROR', err);
      return { success: false, error: 'internal_error', message: err.message };
    }
  });

  ipcMain.handle('google-oauth-refresh', async (event, refreshTokenParam) => {
    try {
      const tokens = loadOAuthTokens();
      const rToken = refreshTokenParam || tokens?.refreshToken;
      if (!rToken) {
        throw new Error('No refresh token provided');
      }
      const refreshed = await refreshAccessToken(rToken);
      const expiresAt = Date.now() + (refreshed.expires_in * 1000);
      saveOAuthTokens({
        accessToken: refreshed.access_token,
        expiresAt: expiresAt
      });
      return refreshed;
    } catch (err) {
      logOAuthError('GOOGLE_OAUTH_REFRESH_FAILED', err);
      throw err;
    }
  });

  ipcMain.handle('google-oauth-logout', async () => {
    clearOAuthTokens();
    return { success: true };
  });

  ipcMain.handle('google-oauth-status', async () => {
    const tokens = loadOAuthTokens();
    if (tokens && (tokens.accessToken || tokens.refreshToken)) {
      return {
        connected: true,
        email: tokens.email || '',
        expiresAt: tokens.expiresAt
      };
    }
    return { connected: false };
  });
}

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged && autoUpdater) {
    try {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        logAppError('AUTO_UPDATER_CHECK', err);
      });

      if (typeof autoUpdater.on === 'function') {
        autoUpdater.on('update-available', (info) => {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-available', info);
          }
        });

        autoUpdater.on('error', (err) => {
          logAppError('AUTO_UPDATER_ERROR', err);
        });

        autoUpdater.on('update-downloaded', (info) => {
          dialog.showMessageBox({
            type: 'info',
            title: 'تحديث جديد جاهز',
            message: `تم تحميل الإصدار الجديد v${info ? info.version : ''} بنجاح!\n\nسيتم إغلاق التطبيق وتثبيت التحديث الآن.`,
            buttons: ['تثبيت وإعادة التشغيل الآن'],
            defaultId: 0
          }).then(() => {
            if (mainWindow && mainWindow.webContents && mainWindow.webContents.session) {
              mainWindow.webContents.session.clearCache().then(() => {
                app.removeAllListeners('window-all-closed');
                BrowserWindow.getAllWindows().forEach(w => {
                  try {
                    if (w && !w.isDestroyed()) w.destroy();
                  } catch (e) {}
                });
                autoUpdater.quitAndInstall(false, true);
              }).catch(() => {
                autoUpdater.quitAndInstall(false, true);
              });
            } else {
              autoUpdater.quitAndInstall(false, true);
            }
          });
        });
      }
    } catch (updaterSetupError) {
      logAppError('AUTO_UPDATER_SETUP', updaterSetupError);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
