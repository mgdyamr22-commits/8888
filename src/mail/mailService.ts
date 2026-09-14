import nodemailer from 'nodemailer';

export interface CompanySmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passDecrypted: string;
  senderEmail: string;
  logo?: string;
  companyName: string;
}

/**
 * Creates and returns a transporter dynamically based on decrypted tenant settings.
 */
export function getDynamicTransporter(config: CompanySmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.passDecrypted
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false // Avoid blocking on intranet self-signed SSL certs
    }
  });
}

/**
 * Verifies live SMTP credentials and records diagnostic logs.
 */
export function testSmtpConnection(config: CompanySmtpConfig): Promise<{ success: boolean; log: string }> {
  return new Promise((resolve) => {
    let logAccumulator = '';
    const appendLog = (msg: string) => {
      logAccumulator += `[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}\n`;
    };

    appendLog(`Connecting to SMTP handshaker node: ${config.host}:${config.port} (Secure: ${config.secure})...`);
    appendLog(`Authenticating as: ${config.user}...`);

    try {
      const transporter = getDynamicTransporter(config);
      transporter.verify((error) => {
        if (error) {
          appendLog(`❌ Authentication or handshake failed: ${error.message}`);
          resolve({ success: false, log: logAccumulator });
        } else {
          appendLog(`✅ SMTP Handshake accepted. Connection successfully verified!`);
          resolve({ success: true, log: logAccumulator });
        }
      });
    } catch (err: any) {
      appendLog(`❌ Fatal thread exception: ${err.message}`);
      resolve({ success: false, log: logAccumulator });
    }
  });
}

/**
 * Sends a dynamic brand-themed RTL design Arabic HTML Email containing the OTP code.
 */
export async function sendOTP(
  toEmail: string,
  username: string,
  otpCode: string,
  ipAddress: string,
  config: CompanySmtpConfig
): Promise<boolean> {
  try {
    const transporter = getDynamicTransporter(config);
    const nowStr = new Date().toLocaleString('ar-EG', { timeZone: 'UTC', hour12: true });

    // Build logo element
    const logoHtml = config.logo 
      ? `<img src="${config.logo}" alt="${config.companyName}" style="max-height: 80px; max-width: 180px; border-radius: 8px;" />`
      : `<div style="font-size: 38px; font-weight: bold; color: #ffffff;">🔐</div>`;

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>رمز تحقق OTP آمن - ${config.companyName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
          direction: rtl;
          text-align: right;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          padding: 40px 20px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 15px 0 0 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 35px;
        }
        .greeting {
          font-size: 18px;
          color: #1e293b;
          margin-bottom: 20px;
          font-weight: 700;
        }
        .desc {
          font-size: 15px;
          color: #475569;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .otp-box {
          background-color: #eff6ff;
          border: 2px dashed #bfdbfe;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-title {
          font-size: 12px;
          text-transform: uppercase;
          color: #2563eb;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        .otp-code {
          font-family: 'Courier New', monospace;
          font-size: 38px;
          font-weight: 800;
          color: #1d4ed8;
          letter-spacing: 8px;
          margin: 0;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #f1f5f9;
        }
        .meta-table td {
          padding: 14px 18px;
          font-size: 14px;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
        }
        .meta-table td.label {
          font-weight: bold;
          color: #64748b;
          background-color: #f8fafc;
          width: 35%;
        }
        .warning-banner {
          background-color: #fff1f2;
          border-right: 4px solid #f43f5e;
          padding: 16px;
          border-radius: 8px;
          color: #9f1239;
          font-size: 13px;
          font-weight: bold;
          line-height: 1.5;
          margin-top: 30px;
        }
        .footer {
          background-color: #f8fafc;
          padding: 25px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px solid #f1f5f9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="margin-bottom: 15px;">
            ${logoHtml}
          </div>
          <h1>${config.companyName}</h1>
        </div>
        <div class="content">
          <p class="greeting">مرحباً ${username}،</p>
          <p class="desc">تلقينا طلباً لإعادة تعيين كلمة مرور الحساب الخاص بك في المنظومة التابعة لـ <strong>${config.companyName}</strong>. يرجى استخدام رمز الأمان (OTP) التالي لفتح خيارات تغيير كلمة السر:</p>
          
          <div class="otp-box">
            <div class="otp-title">رمز التحقق المؤقت (OTP)</div>
            <div class="otp-code">${otpCode}</div>
          </div>

          <p class="desc" style="font-weight: bold; color: #d97706; text-align: center;">⏰ تنتهي صلاحية هذا الرمز بعد ( 5 دقائق ) تلقائياً من تاريخ الطلب.</p>

          <table class="meta-table">
            <tr>
              <td class="label">اسم المستخدم المتأثر</td>
              <td><strong>${username}</strong></td>
            </tr>
            <tr>
              <td class="label">المؤسسة / الشركة</td>
              <td>${config.companyName}</td>
            </tr>
            <tr>
              <td class="label">توقيت تقديم الطلب</td>
              <td>${nowStr} (UTC)</td>
            </tr>
            <tr>
              <td class="label">عنوان بروتوكول الإنترنت (IP)</td>
              <td><code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${ipAddress}</code></td>
            </tr>
          </table>

          <div class="warning-banner">
            ⚠️ تحذير أمني: يرجى عدم الإفصاح عن هذا الرمز لأي شخص كان. إذا لم تكن أنت من بادر بطلب تغيير كلمة السر، فضلاً قم بإبلاغ مشرف الحسابات في <strong>${config.companyName}</strong> فوراً لتفادي أي تهديد محتمل لحسابك.
          </div>
        </div>
        <div class="footer">
          هذا البريد تم إرساله تلقائياً عبر بوابة خادم SMTP الخاص بـ ${config.companyName}.<br>
          جميع الحقوق محفوظة &copy; ${new Date().getFullYear()} ${config.companyName}
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"${config.companyName}" <${config.senderEmail}>`,
      to: toEmail,
      subject: `🔐 [${config.companyName}] رمز التحقق المؤقت لاستعادة حسابك: ${username}`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email successfully dispatched to: ${toEmail}. MessageID: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error('❌ Failed to send dynamic verification email:', err.message);
    return false;
  }
}

/**
 * Sends a notification email informing the admin that the user's password was successfully updated.
 */
export async function sendResetResetNotification(
  toEmail: string,
  username: string,
  ipAddress: string,
  config: CompanySmtpConfig
): Promise<boolean> {
  try {
    const transporter = getDynamicTransporter(config);
    const nowStr = new Date().toLocaleString('ar-EG', { timeZone: 'UTC', hour12: true });

    const logoHtml = config.logo 
      ? `<img src="${config.logo}" alt="${config.companyName}" style="max-height: 80px; max-width: 180px; border-radius: 8px;" />`
      : `<div style="font-size: 38px; font-weight: bold; color: #ffffff;">🔐</div>`;

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>تنبيه أمني: تحديث كلمة المرور - ${config.companyName}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; direction: rtl; text-align: right; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 35px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 15px 0 0 0; font-size: 22px; font-weight: 800; }
        .content { padding: 40px 35px; }
        .greeting { font-size: 18px; color: #1e293b; margin-bottom: 20px; font-weight: 700; }
        .success-accent { color: #10b981; font-weight: bold; }
        .meta-table { width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #f1f5f9; }
        .meta-table td { padding: 12px 15px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; }
        .meta-table td.label { font-weight: bold; color: #64748b; background-color: #f8fafc; width: 35%; }
        .footer { background-color: #f8fafc; padding: 25px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="margin-bottom: 10px;">${logoHtml}</div>
          <h1>🔐 إشعار أمني هام</h1>
        </div>
        <div class="content">
          <p class="greeting">السيد مسؤول الحماية والمصادقة في ${config.companyName}،</p>
          <p>نحيطكم علماً بأنه قد تم <span class="success-accent">تحديث كلمة المرور بنجاح</span> للحساب التالي بعد مصادقة رمز الأمان (OTP) المدخل:</p>
          
          <table class="meta-table">
            <tr>
              <td class="label">اسم المستخدم المتأثر</td>
              <td><strong>${username}</strong></td>
            </tr>
            <tr>
              <td class="label">المؤسسة الراعية</td>
              <td>${config.companyName}</td>
            </tr>
            <tr>
              <td class="label">توقيت التغيير المعتمد</td>
              <td>${nowStr} (UTC)</td>
            </tr>
            <tr>
              <td class="label">عنوان بروتوكول الإنترنت (IP)</td>
              <td><code>${ipAddress}</code></td>
            </tr>
          </table>

          <p style="color: #ef4444; font-weight: bold;">إذا لم تكن على علم بهذا الإجراء أو تظن بوقوع دخول غير مشروع، يرجى تجميد حساب الموظف المذكور فوراً وفحص سجلات الدخول.</p>
        </div>
        <div class="footer">
          تنبيه نظام تلقائي مرسل من المخدم الآمن المعتمد لـ ${config.companyName} &copy; ${new Date().getFullYear()}
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"${config.companyName}" <${config.senderEmail}>`,
      to: toEmail,
      subject: `🚨 [تنبيه أمني] تم تعديل كلمة مرور الحساب لـ [ ${username} ] في ${config.companyName}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (err: any) {
    console.error('Error sending reset confirmation email to admin:', err.message);
    return false;
  }
}
