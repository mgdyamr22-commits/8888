import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { createToken, verifyToken } from '../middleware/authMiddleware';
import bcrypt from 'bcryptjs';

const router = Router();

function getDelegateFromToken(req: Request): any | null {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.delegateId) return null;
  
  const raw = (db as any).getRawData();
  const delegates = raw.delegates || [];
  return delegates.find((d: any) => d.id === payload.delegateId) || null;
}

/**
 * 1. POST /api/delegate/login
 */
router.post(['/login', '/login.php'], async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور للمندوب.' });
    }

    const raw = (db as any).getRawData();
    const delegates = raw.delegates || [];

    const delegate = delegates.find((d: any) => 
      (d.username && d.username.toLowerCase() === String(username).trim().toLowerCase()) ||
      (d.name && d.name.toLowerCase() === String(username).trim().toLowerCase())
    );

    if (!delegate) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة، لم يتم العثور على حساب المندوب.' });
    }

    if (delegate.isActive === false) {
      return res.status(403).json({ success: false, message: 'حساب المندوب معطل حالياً من قِبل الإدارة.' });
    }

    // Verify password if set
    let passwordMatches = true;
    if (delegate.password) {
      if (delegate.password.startsWith('$2a$') || delegate.password.startsWith('$2b$')) {
        passwordMatches = await bcrypt.compare(password, delegate.password);
      } else {
        passwordMatches = (delegate.password === password);
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة.' });
    }

    const token = createToken({
      delegateId: delegate.id,
      username: delegate.username,
      name: delegate.name || delegate.username,
      type: 'delegate'
    }, 30 * 24 * 60 * 60 * 1000);

    const delegateData = {
      id: delegate.id,
      name: delegate.name || delegate.username,
      username: delegate.username,
      phone: delegate.phone || '',
      email: delegate.email || '',
      specialty: delegate.specialty || 'مبيعات',
      target: delegate.target || 0,
      isActive: delegate.isActive !== false,
      token
    };

    return res.json({
      success: true,
      message: 'تم تسجيل دخول المندوب بنجاح.',
      delegate: delegateData,
      token
    });
  } catch (err: any) {
    console.error('Delegate login error:', err);
    return res.status(500).json({ success: false, message: 'فشل معالجة تسجيل الدخول.' });
  }
});

/**
 * 2. GET & PUT /api/delegate/profile
 */
router.get(['/profile', '/profile.php'], (req: Request, res: Response) => {
  const delegate = getDelegateFromToken(req);
  if (!delegate) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك بالوصول. يرجى تسجيل الدخول.' });
  }

  return res.json({
    success: true,
    profile: {
      id: delegate.id,
      name: delegate.name || delegate.username,
      username: delegate.username,
      phone: delegate.phone || '',
      email: delegate.email || '',
      specialty: delegate.specialty || 'مبيعات',
      target: delegate.target || 0,
      isActive: delegate.isActive !== false
    }
  });
});

router.put(['/profile', '/profile.php'], async (req: Request, res: Response) => {
  const delegate = getDelegateFromToken(req);
  if (!delegate) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك بالوصول. يرجى تسجيل الدخول.' });
  }

  const { name, phone, email, password } = req.body || {};
  const raw = (db as any).getRawData();
  const dIndex = (raw.delegates || []).findIndex((d: any) => d.id === delegate.id);

  if (dIndex === -1) {
    return res.status(404).json({ success: false, message: 'المندوب غير موجود.' });
  }

  if (name) raw.delegates[dIndex].name = String(name).trim();
  if (phone !== undefined) raw.delegates[dIndex].phone = String(phone).trim();
  if (email !== undefined) raw.delegates[dIndex].email = String(email).trim();
  if (password) {
    raw.delegates[dIndex].password = await bcrypt.hash(password, 10);
  }

  db.rawSave();

  return res.json({
    success: true,
    message: 'تم تحديث البيانات الشخصية للمندوب بنجاح.',
    delegate: {
      id: raw.delegates[dIndex].id,
      name: raw.delegates[dIndex].name || raw.delegates[dIndex].username,
      username: raw.delegates[dIndex].username,
      phone: raw.delegates[dIndex].phone || '',
      email: raw.delegates[dIndex].email || '',
      specialty: raw.delegates[dIndex].specialty || 'مبيعات',
      target: raw.delegates[dIndex].target || 0,
      isActive: raw.delegates[dIndex].isActive !== false
    }
  });
});

/**
 * 3. GET /api/delegate/cars
 * Shows showroom cars with privacy rules for customs documents
 */
router.get(['/cars', '/cars.php'], (req: Request, res: Response) => {
  const delegate = getDelegateFromToken(req);
  const raw = (db as any).getRawData();
  const allCars = raw.cars || [];

  const delegateUsername = delegate?.username?.toLowerCase();
  const delegateName = (delegate?.name || delegate?.username || '').toLowerCase();
  const delegateId = delegate?.id;

  // Filter showroom cars (not outbound, not sold)
  const showroomCars = allCars.filter((c: any) => {
    const isOutbound = c.isOutbound === true || c.is_outbound === 1;
    const st = String(c.status || '').trim();
    const isSold = (st === 'مباعة' || st === 'تم البيع' || st === 'خارج المعرض');
    return !isOutbound && !isSold;
  });

  const sanitized = showroomCars.map((c: any) => {
    const reservedBy = (c.reservedByUserId || c.reserved_by_user_id || '').trim().toLowerCase();
    const seller = (c.seller || '').trim().toLowerCase();

    const isReservedByMe = Boolean(
      (reservedBy && (reservedBy === delegateUsername || reservedBy === delegateName || reservedBy === delegateId)) ||
      (seller && (seller === delegateUsername || seller === delegateName)) ||
      (c.customData?.reservedByDelegateId && c.customData.reservedByDelegateId === delegateId)
    );

    const canAccessDocs = isReservedByMe;

    return {
      ...c,
      cardFile: canAccessDocs ? c.cardFile : null,
      cardFileName: canAccessDocs ? c.cardFileName : null,
      canAccessDocs,
      isReservedByMe
    };
  });

  return res.json({ success: true, cars: sanitized });
});

/**
 * 4. POST /api/delegate/reserve
 * Automatic confirmation without prompting for customer data
 */
router.post(['/reserve', '/reserve.php'], (req: Request, res: Response) => {
  const delegate = getDelegateFromToken(req);
  if (!delegate) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك بالحجز. يرجى تسجيل الدخول كمندوب.' });
  }

  const { carId } = req.body || {};
  if (!carId) {
    return res.status(400).json({ success: false, message: 'معرف السيارة مطلوب.' });
  }

  const raw = (db as any).getRawData();
  const car = (raw.cars || []).find((c: any) => c.id === carId);

  if (!car) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة.' });
  }

  const currentStatus = String(car.status || '').trim();
  const isReserved = (currentStatus === 'محجوزة' || currentStatus === 'محجوز' || currentStatus === 'Reserved');
  if (isReserved) {
    const reserver = car.reservedByUserId || car.seller || 'مندوب آخر';
    return res.status(409).json({ success: false, message: `عذراً، هذه السيارة محجوزة مسبقاً باسم: ${reserver}` });
  }

  const delegateDisplayName = delegate.name || delegate.username;
  const statusNote = `محجوزة بواسطة المندوب: ${delegateDisplayName}`;

  car.status = 'محجوزة';
  car.reservedByUserId = delegateDisplayName;
  car.seller = delegateDisplayName;
  car.statusNote = statusNote;
  car.reservationDate = new Date().toISOString();
  car.lastModified = new Date().toISOString();
  if (!car.customData) car.customData = {};
  car.customData.reservedByDelegateId = delegate.id;
  car.customData.reservedByDelegateName = delegateDisplayName;

  if (!car.history) car.history = [];
  car.history.push({
    id: 'hist-' + Date.now(),
    action: `حجز سيارة تلقائي للمندوب: ${delegateDisplayName}`,
    timestamp: new Date().toISOString(),
    user: delegateDisplayName
  });

  db.rawSave();

  return res.json({
    success: true,
    message: `تم حجز السيارة ${car.brand} ${car.model} بنجاح باسم المندوب: ${delegateDisplayName}`,
    car: {
      ...car,
      isReservedByMe: true,
      canAccessDocs: true
    }
  });
});

/**
 * 5. POST /api/delegate/cancel-reserve
 */
router.post(['/cancel-reserve', '/cancel-reserve.php'], (req: Request, res: Response) => {
  const delegate = getDelegateFromToken(req);
  if (!delegate) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك بإلغاء الحجز.' });
  }

  const { carId } = req.body || {};
  if (!carId) {
    return res.status(400).json({ success: false, message: 'معرف السيارة مطلوب.' });
  }

  const raw = (db as any).getRawData();
  const car = (raw.cars || []).find((c: any) => c.id === carId);

  if (!car) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة.' });
  }

  const delegateDisplayName = (delegate.name || delegate.username).toLowerCase();
  const reservedBy = String(car.reservedByUserId || car.seller || '').trim().toLowerCase();
  const isMine = (
    reservedBy === delegateDisplayName || 
    reservedBy === delegate.username.toLowerCase() ||
    car.customData?.reservedByDelegateId === delegate.id
  );

  if (!isMine) {
    return res.status(403).json({ success: false, message: 'عذراً، لا يمكنك إلغاء حجز سيارة ليست محجوزة باسمك.' });
  }

  car.status = 'متوفرة';
  car.reservedByUserId = undefined;
  car.seller = undefined;
  car.statusNote = undefined;
  car.reservationDate = undefined;
  car.lastModified = new Date().toISOString();
  if (car.customData) {
    delete car.customData.reservedByDelegateId;
    delete car.customData.reservedByDelegateName;
  }

  if (!car.history) car.history = [];
  car.history.push({
    id: 'hist-' + Date.now(),
    action: `إلغاء حجز السيارة وإعادتها للمعرض بواسطة المندوب: ${delegate.name || delegate.username}`,
    timestamp: new Date().toISOString(),
    user: delegate.name || delegate.username
  });

  db.rawSave();

  return res.json({
    success: true,
    message: `تم إلغاء حجز السيارة ${car.brand} ${car.model} وإعادتها للمخزون المتاح بنجاح.`,
    car: {
      ...car,
      isReservedByMe: false,
      canAccessDocs: false,
      cardFile: null
    }
  });
});

/**
 * 6. GET /api/delegate/my-bookings
 */
router.get(['/my-bookings', '/my-bookings.php'], (req: Request, res: Response) => {
  const delegate = getDelegateFromToken(req);
  if (!delegate) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك بالوصول.' });
  }

  const raw = (db as any).getRawData();
  const allCars = raw.cars || [];
  const delegateDisplayName = (delegate.name || delegate.username).toLowerCase();

  const myBookings = allCars.filter((c: any) => {
    const st = String(c.status || '').trim();
    const isReserved = (st === 'محجوزة' || st === 'محجوز' || st === 'Reserved');
    if (!isReserved) return false;

    const resUser = String(c.reservedByUserId || c.seller || '').trim().toLowerCase();
    return (
      resUser === delegateDisplayName ||
      resUser === delegate.username.toLowerCase() ||
      c.customData?.reservedByDelegateId === delegate.id
    );
  }).map((c: any) => ({
    ...c,
    canAccessDocs: true,
    isReservedByMe: true
  }));

  return res.json({
    success: true,
    bookings: myBookings,
    count: myBookings.length
  });
});

export default router;
