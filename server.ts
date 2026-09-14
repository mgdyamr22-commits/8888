import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import authRoutes from './src/routes/authRoutes';
import installRoutes from './src/routes/installRoutes';
import carRoutes from './src/routes/carRoutes';
import salesRoutes from './src/routes/salesRoutes';
import transferRoutes from './src/routes/transferRoutes';
import customerRoutes from './src/routes/customerRoutes';
import costRoutes from './src/routes/costRoutes';
import letterRoutes from './src/routes/letterRoutes';
import reportRoutes from './src/routes/reportRoutes';
import settingsRoutes from './src/routes/settingsRoutes';
import fileRoutes from './src/routes/fileRoutes';
import backupRoutes from './src/routes/backupRoutes';
import lanRoutes from './src/routes/lanRoutes';
import delegateRoutes from './src/routes/delegateRoutes';
import { db } from './src/database/db';
import { dbManager } from './src/database/mysqlClient';
import { runAllMigrations } from './src/database/mysqlMigrations';
import bcrypt from 'bcryptjs';

async function ensureDatabaseReady() {
  try {
    if (!dbManager.hasPool()) {
      return;
    }
    const tableRows: any = await dbManager.query('SHOW TABLES');
    const count = Array.isArray(tableRows) ? tableRows.length : 0;
    if (count < 10) {
      console.log('🔄 Initializing database schema and running migrations...');
      await runAllMigrations();
    }

    // Check if admin user exists in MySQL/SQLite
    const userRows: any = await dbManager.query("SELECT COUNT(*) as count FROM users WHERE role = 'مدير'");
    const adminCount = userRows[0]?.count || 0;
    if (adminCount === 0) {
      console.log('👤 Seeding default admin and default organization...');
      const tenantId = 'org-default';
      const orgName = 'مؤسسة المخزون للسيارات';
      const orgPhone = '0500000000';

      await dbManager.query(`
        INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, address)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `, [tenantId, orgName, '1010101010', '300000000000003', orgPhone, 'المملكة العربية السعودية']);

      await dbManager.query(`
        INSERT INTO branches (id, tenant_id, name, code, is_active)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `, ['branch-main', tenantId, 'الفرع الرئيسي - المعرض العام', 'MAIN-01']);

      const adminUsername = 'admin';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin', salt);
      const recoveryCodePlain = 'AFS-2026-PRO8-X99Z';
      const recoveryCodeHash = await bcrypt.hash(recoveryCodePlain, 10);
      const adminId = 'u_admin_1';

      await dbManager.query(`
        INSERT INTO users (
          id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone,
          primary_admin, recovery_code_hash, is_active
        ) VALUES (?, ?, ?, ?, ?, 'مدير', ?, ?, ?, 1, ?, 1)
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
      `, [adminId, tenantId, 'branch-main', adminUsername, passwordHash, 'المدير العام', 'admin@almakhzoun.com', orgPhone, recoveryCodeHash]);

      const allPermissions = [
        'view_dashboard', 'manage_inventory', 'view_reports',
        'manage_users', 'manage_settings', 'manage_backup',
        'view_financials', 'export_data', 'view_sales'
      ];

      for (const perm of allPermissions) {
        await dbManager.query(`
          INSERT INTO user_permissions (user_id, permission_key)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE permission_key = VALUES(permission_key)
        `, [adminId, perm]);
      }

      await dbManager.query(`
        INSERT INTO settings (id, tenant_id, org_name, org_type, contact_number, tax_number, commercial_register, address, system_version)
        VALUES (?, ?, ?, 'مؤسسة', ?, ?, ?, ?, '3.6.0')
        ON DUPLICATE KEY UPDATE org_name = VALUES(org_name)
      `, ['settings_default', tenantId, orgName, orgPhone, '300000000000003', '1010101010', 'المملكة العربية السعودية']);

      // Ensure .installed lock file exists
      const lockPath = path.join(process.cwd(), '.installed');
      if (!fs.existsSync(lockPath)) {
        fs.writeFileSync(lockPath, new Date().toISOString(), 'utf8');
      }
      console.log('✅ Database schema and default admin initialized successfully.');
    }
  } catch (err) {
    console.error('⚠️ Notice in ensureDatabaseReady:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure database tables and initial user are provisioned
  await ensureDatabaseReady();

  // Set trust proxy (important for reading accurate client IPs)
  app.set('trust proxy', true);

  // Manual CORS middleware to support multi-device local WiFi connections across different IP addresses/Origins
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Support requests originating from subpaths or with .php extensions (e.g. /hosting_package/api/*, /host_package/api/*)
  app.use((req, res, next) => {
    // If request contains /api/ or /installer/ with a subpath prefix, strip the prefix
    const apiMatch = req.url.match(/^\/[^/]+(\/(?:api|installer)\/.*)$/);
    if (apiMatch && !req.url.startsWith('/api/') && !req.url.startsWith('/installer/')) {
      req.url = apiMatch[1];
    }

    // Handle Front-controller query route: /api/index.php?route=cars -> /api/cars
    if (req.url.startsWith('/api/index.php') || req.url.startsWith('/api/index?')) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const routeParam = urlObj.searchParams.get('route') || urlObj.searchParams.get('path');
        if (routeParam) {
          urlObj.searchParams.delete('route');
          urlObj.searchParams.delete('path');
          const remainingQuery = urlObj.searchParams.toString();
          req.url = `/api/${routeParam.replace(/^\/+/, '')}${remainingQuery ? '?' + remainingQuery : ''}`;
        }
      } catch {}
    }

    // Handle /api/:entity/detail.php?id=XXX or /api/:entity/detail?id=XXX -> /api/:entity/XXX
    const detailMatch = req.url.match(/^\/api\/([a-zA-Z0-9_-]+)\/detail(?:\.php)?(\?.*)?$/);
    if (detailMatch) {
      try {
        const entity = detailMatch[1];
        const urlObj = new URL(req.url, 'http://localhost');
        const idParam = urlObj.searchParams.get('id');
        if (idParam) {
          urlObj.searchParams.delete('id');
          const remainingQuery = urlObj.searchParams.toString();
          req.url = `/api/${entity}/${encodeURIComponent(idParam)}${remainingQuery ? '?' + remainingQuery : ''}`;
        }
      } catch {}
    }

    // Handle /api/:entity/index.php or /api/:entity/index -> /api/:entity
    req.url = req.url.replace(/\/index(?:\.php)?(\?|$)/, '$1');

    // Strip remaining .php extensions inside /api/
    if (req.url.startsWith('/api/') && req.url.includes('.php')) {
      req.url = req.url.replace(/\.php(\?|$)/, '$1');
    }

    // Normalize multiple slashes (excluding protocol if present)
    if (req.url.startsWith('/')) {
      req.url = req.url.replace(/\/+/g, '/');
    }

    next();
  });

  // Parse JSON bodies with custom limit to support high-res base64 logos and stamps
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static uploads directory
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));

  // Mount API & Installer routes (at root and with hosting package prefixes)
  const mountRoutes = (prefix = '') => {
    app.use(`${prefix}/installer/actions.php`, installRoutes);
    app.use(`${prefix}/installer/actions`, installRoutes);
    app.use(`${prefix}/installer`, installRoutes);
    app.use(`${prefix}/api/install`, installRoutes);
    app.use(`${prefix}/api/auth`, authRoutes);
    app.use(`${prefix}/api`, authRoutes);
    app.use(`${prefix}/api/cars`, carRoutes);
    app.use(`${prefix}/api/sales`, salesRoutes);
    app.use(`${prefix}/api/transfers`, transferRoutes);
    app.use(`${prefix}/api/customers`, customerRoutes);
    app.use(`${prefix}/api/costs`, costRoutes);
    app.use(`${prefix}/api/letters`, letterRoutes);
    app.use(`${prefix}/api/reports`, reportRoutes);
    app.use(`${prefix}/api/settings`, settingsRoutes);
    app.use(`${prefix}/api/files`, fileRoutes);
    app.use(`${prefix}/api/backups`, backupRoutes);
    app.use(`${prefix}/api/lan`, lanRoutes);
    app.use(`${prefix}/api/delegate`, delegateRoutes);

    // Tenant and Organization route
    app.get([`${prefix}/api/tenants`, `${prefix}/api/tenants/index.php`, `${prefix}/api/tenants/index`], async (req, res) => {
      try {
        let tenants: any[] = [];
        if (dbManager.hasPool()) {
          try {
            const rows: any = await dbManager.query('SELECT * FROM tenants ORDER BY created_at ASC');
            if (Array.isArray(rows) && rows.length > 0) {
              tenants = rows.map((r: any) => ({
                id: r.id,
                name: r.name,
                commercialRegistry: r.commercial_registry || '',
                taxNumber: r.tax_number || '',
                phone: r.phone || '',
                email: r.email || '',
                address: r.address || '',
                logoUrl: r.logo_url || '',
                stampUrl: r.stamp_url || '',
                createdAt: r.created_at || new Date().toISOString()
              }));
            }
          } catch (e) {}
        }

        if (tenants.length === 0) {
          const installedPath = path.join(process.cwd(), 'config', 'installed.json');
          if (fs.existsSync(installedPath)) {
            try {
              const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
              if (installed.organization) {
                const o = installed.organization;
                tenants.push({
                  id: 'org-default',
                  name: o.name || 'مؤسسة المخزون لتجارة السيارات',
                  commercialRegistry: o.commercialRegistry || o.commercialRegister || '',
                  taxNumber: o.taxNumber || '',
                  phone: o.phone || '',
                  email: o.email || '',
                  address: o.address || '',
                  logoUrl: o.logoUrl || o.logo || '',
                  stampUrl: o.stampUrl || o.stamp || '',
                  createdAt: installed.installed_at || new Date().toISOString()
                });
              }
            } catch (e) {}
          }
        }

        res.json({
          success: true,
          tenants,
          count: tenants.length
        });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    });
  };

  mountRoutes('');
  mountRoutes('/hosting_package');
  mountRoutes('/host_package');

  // Basic healthcheck route
  app.get(['/api/health', '/hosting_package/api/health', '/host_package/api/health'], (req, res) => {
    res.json({
      status: 'ok',
      database: dbManager.hasPool() ? 'connected' : 'unconfigured',
      serverTime: new Date().toISOString()
    });
  });

  // Intercept Google OAuth Callback if code parameter exists
  app.get('/', (req, res, next) => {
    const code = req.query.code;
    if (code) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send('<div style="font-family: sans-serif; text-align: center; padding-top: 50px; direction: rtl;"><h1>✅ تمت المصادقة بنجاح!</h1><p>يمكنك الآن العودة إلى برنامج مخزوني وإغلاق هذه النافذة.</p></div>');
      
      const g = global as any;
      if (typeof g.onGoogleOAuthCode === 'function') {
        g.onGoogleOAuthCode(code as string);
      }
      return;
    }
    next();
  });

  // Serve Frontend with Vite in Development OR Static files in Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('📦 Serving production static bundle...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Route all frontend routes to index.html for full React SPA support without 404
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.includes('/api/') && !req.path.includes('/installer/') && !req.path.startsWith('/uploads/')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      next();
    });
  }

  // Gracefully handle server shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Closing SQLite database connection...');
    db.close((err) => {
      if (err) console.error('Error closing database:', err.message);
      process.exit(0);
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Full-stack Server listening at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to launch unified backend/frontend server:', err);
});
