import { db } from '../database/db';
import bcrypt from 'bcryptjs';

export interface OTPRequestResult {
  success: boolean;
  message: string;
  adminEmail?: string;
  otpCode?: string; // only for log output if needed, but we keep it private on release
}

/**
 * Handles generating, hashing, and storing a new 6-digit OTP code for a user.
 * Implements a strict rate limit of "no more than 3 requests per 15 minutes" to prevent spam.
 */
export function generateOTP(username: string, ipAddress: string): Promise<OTPRequestResult> {
  return new Promise((resolve, reject) => {
    // 1. Resolve User
    db.get('SELECT * FROM Users WHERE username = ?', [username], (err, user: any) => {
      if (err) {
        return resolve({ success: false, message: 'خطأ بقاعدة البيانات أثناء التحقق من الموظف.' });
      }
      if (!user) {
        return resolve({ success: false, message: 'اسم المستخدم غير مسجل من قبل المسؤول.' });
      }

      const userId = user.id;
      const adminEmail = user.adminEmail || 'admin@alforsancar.com'; // Fallback admin email

      // 2. Rate Limit: Check past OTP requests in last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      db.all(
        'SELECT createdAt FROM OTP_Logs WHERE userId = ? AND createdAt >= ?',
        [userId, fifteenMinutesAgo],
        (err, preRequests) => {
          if (err) {
            return resolve({ success: false, message: 'خطأ في التحقق من محاولات إرسال الرموز.' });
          }

          if (preRequests && preRequests.length >= 3) {
            return resolve({ 
              success: false, 
              message: 'بروتوكول الأمان: تم تجاوز الحد الأقصى للطلبات (3 طلبات كل 15 دقيقة).' 
            });
          }

          // 3. Invalidate any previous pending OTPs to prevent replay attacks
          db.run(
            "UPDATE OTP_Logs SET status = 'EXPIRED' WHERE userId = ? AND status = 'PENDING'",
            [userId],
            (err) => {
              if (err) {
                console.error('Warning: previous pending OTP update failed:', err);
              }

              // 4. Generate 6-Digit OTP code
              const digitOTP = String(Math.floor(100000 + Math.random() * 900000));
              const salt = bcrypt.genSaltSync(10);
              const hashedOTP = bcrypt.hashSync(digitOTP, salt);

              const now = new Date();
              const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 Minutes expiry

              // 5. Save securely to database
              db.run(
                `INSERT INTO OTP_Logs (userId, otpHash, createdAt, expiresAt, attempts, ipAddress, status)
                 VALUES (?, ?, ?, ?, 0, ?, 'PENDING')`,
                [userId, hashedOTP, now.toISOString(), expiresAt.toISOString(), ipAddress],
                (err) => {
                  if (err) {
                    console.error('Error recording OTP Log:', err);
                    return resolve({ success: false, message: 'فشل في حفظ رمز التحقق في النظام المعزول.' });
                  }

                  resolve({
                    success: true,
                    message: 'تم توليد وتأمين كود تحقق بنجاح.',
                    adminEmail: adminEmail,
                    otpCode: digitOTP // Output for SMTP mailer consumption
                  });
                }
              );
            }
          );
        }
      );
    });
  });
}

export interface OTPVerifyResult {
  success: boolean;
  message: string;
  userId?: string;
}

/**
 * Verifies a user-supplied OTP code, tracks failed attempts (max 3), updates statuses, and blocks brute-force.
 */
export function verifyOTPCode(username: string, code: string, ipAddress: string): Promise<OTPVerifyResult> {
  return new Promise((resolve) => {
    db.get('SELECT * FROM Users WHERE username = ?', [username], (err, user: any) => {
      if (err || !user) {
        return resolve({ success: false, message: 'اسم المستخدم المدخل غير مطابق للسجلات الآمنة.' });
      }

      const userId = user.id;

      // Find the currently pending OTP for this user
      db.get(
        `SELECT * FROM OTP_Logs WHERE userId = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1`,
        [userId],
        (err, log: any) => {
          if (err) {
            return resolve({ success: false, message: 'خطأ في الاتصال بسجلات المصادقة.' });
          }

          if (!log) {
            return resolve({ success: false, message: 'لا توجد جلسة طلب رمز تحقق حالية بانتظار التأكيد.' });
          }

          // Check expiry
          const now = new Date();
          const expiresAt = new Date(log.expiresAt);
          if (now > expiresAt) {
            db.run("UPDATE OTP_Logs SET status = 'EXPIRED' WHERE id = ?", [log.id]);
            return resolve({ success: false, message: 'رمز الأمان OTP منتهي الصلاحية (مر أكثر من 5 دقائق).' });
          }

          // Check attempts brute force threshold (blocking on >= 3 failed attempts)
          if (log.attempts >= 3) {
            db.run("UPDATE OTP_Logs SET status = 'FAILED_MAX_ATTEMPTS' WHERE id = ?", [log.id]);
            return resolve({ 
              success: false, 
              message: 'تم إقفال هذا الرمز لتجاوز المحاولات الخاملة (الحد الأقصى 3 محاولات) لحماية الحساب.' 
            });
          }

          // Compare user submitted code to database hashed OTP
          const isCorrect = bcrypt.compareSync(code, log.otpHash);

          if (!isCorrect) {
            const nextAttempts = log.attempts + 1;
            if (nextAttempts >= 3) {
              db.run(
                "UPDATE OTP_Logs SET attempts = ?, status = 'FAILED_MAX_ATTEMPTS' WHERE id = ?",
                [nextAttempts, log.id],
                () => {
                  resolve({ 
                    success: false, 
                    message: 'تم رفض الرمز وتجميد الطلب لتجاوز المحاولات الخاطئة المتاحة (3 محاولات).' 
                  });
                }
              );
            } else {
              db.run(
                'UPDATE OTP_Logs SET attempts = ? WHERE id = ?',
                [nextAttempts, log.id],
                () => {
                  resolve({ 
                    success: false, 
                    message: `كود التحقق غير صحيح. المحاولات المتبقية: ${3 - nextAttempts}.` 
                  });
                }
              );
            }
          } else {
            // Success! Update OTP Log to verified
            db.run(
              "UPDATE OTP_Logs SET status = 'VERIFIED' WHERE id = ?",
              [log.id],
              () => {
                // Log action
                db.run(
                  `INSERT INTO Log_History (userId, action, details, ipAddress)
                   VALUES (?, 'VERIFIED_OTP', 'Successfully verified OTP for password reset.', ?)`,
                  [userId, ipAddress],
                  () => {
                    resolve({
                      success: true,
                      message: 'عملية التحقق ناجحة.',
                      userId: userId
                    });
                  }
                );
              }
            );
          }
        }
      );
    });
  });
}
