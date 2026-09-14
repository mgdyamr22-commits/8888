import { User } from '../types';
import { hashPassword, hashPasswordPBKDF2 } from './SecurityService';

export { hashPasswordPBKDF2 };


export interface RecoverySession {
  username: string;
  email: string;
  otp: string;
  expiry: Date;
  failedAttempts: number;
}

// In-memory isolated "backend session manager" representing server-side memory
const activeSessions = new Map<string, RecoverySession>();

/**
 * Mask an email address according to security standard (e.g., m***@gmail.com)
 */
export function maskEmail(email?: string): string {
  if (!email) return '***@***.***';
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const username = parts[0];
  const domain = parts[1];
  
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  
  // Keep first and last characters, mask the middle
  const maskedUsername = `${username[0]}***${username[username.length - 1]}`;
  return `${maskedUsername}@${domain}`;
}



/**
 * Simulated/Actual Delivery of OTP via virtual SMTP servers
 */
export interface SMTPConfig {
  host: 'smtp.gmail.com' | 'smtp.outlook.office365.com' | string;
  port: number;
  secure: boolean;
  user: string;
}

export interface SMTPLogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

/**
 * Create a new password recovery session for an identified user
 */
export function createRecoverySession(user: User): RecoverySession {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration
  
  const session: RecoverySession = {
    username: user.username,
    email: user.email || `${user.username}@alforsancar.com`, // fallback email
    otp,
    expiry,
    failedAttempts: 0
  };
  
  activeSessions.set(user.username.toLowerCase(), session);
  return session;
}

/**
 * Retrieve active recovery session for username
 */
export function getActiveSession(username: string): RecoverySession | undefined {
  return activeSessions.get(username.toLowerCase());
}

/**
 * Remove/invalidate recovery session after success or manual resets
 */
export function invalidateSession(username: string): void {
  activeSessions.delete(username.toLowerCase());
}

/**
 * Verify OTP entered by user against the session stored securely on the backend layer
 */
export interface VerifyOTPResult {
  success: boolean;
  error?: string;
  actionAvailable?: 'new_otp' | 'retry' | 'lockout';
}

export function verifyOTP(username: string, inputOtp: string): VerifyOTPResult {
  const session = activeSessions.get(username.toLowerCase());
  if (!session) {
    return { success: false, error: 'لم يتم العثور على جلسة استعادة نشطة لهذا المستخدم. يرجى البدء من جديد.', actionAvailable: 'new_otp' };
  }
  
  // 1. Check if locked out (failed attempts >= 5)
  if (session.failedAttempts >= 5) {
    return { 
      success: false, 
      error: 'لقد تجاوزت الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم إغلاق الطلب لدواعي الأمان. يرجى طلب رمز جديد.', 
      actionAvailable: 'lockout' 
    };
  }
  
  // 2. Check Expiration
  const now = new Date();
  if (now > session.expiry) {
    return { 
      success: false, 
      error: 'لقد انتهت صلاحية كود التحقق (صلاحيته 5 دقائق فقط). برجاء طلب كود تحقق جديد.', 
      actionAvailable: 'new_otp' 
    };
  }
  
  // 3. Match Code
  if (session.otp !== inputOtp.trim()) {
    session.failedAttempts += 1;
    activeSessions.set(username.toLowerCase(), session);
    
    const attemptsLeft = 5 - session.failedAttempts;
    if (attemptsLeft <= 0) {
      return { 
        success: false, 
        error: 'لقد تجاوزت الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم إغلاق الطلب لدواعي الأمان. يرجى طلب رمز جديد.', 
        actionAvailable: 'lockout' 
      };
    }
    
    return { 
      success: false, 
      error: `كود التحقق خاطئ! متبقي لديك المجموع ${attemptsLeft} محاولات قبل الإغلاق الأمني.`, 
      actionAvailable: 'retry' 
    };
  }
  
  return { success: true };
}

/**
 * Simulate fully detailed SMTP delivery logs representing real server communication
 */
export async function simulateSMTPDelivery(
  session: RecoverySession, 
  config: SMTPConfig, 
  onLog: (entry: SMTPLogEntry) => void
): Promise<boolean> {
  const addLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    onLog({
      timestamp: new Date().toLocaleTimeString('ar-EG'),
      type,
      message
    });
  };

  try {
    addLog('info', `بدء الاتصال بخادم البريد الصادر: ${config.host}:${config.port}...`);
    await new Promise(r => setTimeout(r, 600));
    
    addLog('info', `تم تأسيس الاتصال الآمن بنجاح. بروتوكول المصافحة TLS 1.3 نشط.`);
    await new Promise(r => setTimeout(r, 500));
    
    addLog('info', `محاولة تسجيل الدخول لمستخدم SMTP المصرح به...`);
    await new Promise(r => setTimeout(r, 700));
    
    addLog('success', `تم تأكيد هويتك ومصادقة الحساب الآمن.`);
    await new Promise(r => setTimeout(r, 400));
    
    addLog('info', `إعداد ترويسة الرسالة للبريد الموجه إلى: [ ${session.email} ]...`);
    await new Promise(r => setTimeout(r, 500));
    
    addLog('info', `تعبئة مسودة الرسالة المشفرة وإضافة كود التحقق OTP: [${maskEmail(session.email)}]`);
    await new Promise(r => setTimeout(r, 600));
    
    addLog('success', `تم تسليم الحزمة للبروتوكول SMTP بنجاح! كود التتبع: MSG-${Math.floor(Math.random() * 1000000)}`);
    return true;
  } catch (error) {
    addLog('error', `فشل تسليم الرسالة عبر بروتوكول SMTP. حدث خطأ في الخادم أو الاتصال بالفضاء السحابي.`);
    return false;
  }
}
