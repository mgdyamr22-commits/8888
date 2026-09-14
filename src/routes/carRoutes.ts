import { Router, Request, Response } from 'express';
import { dbManager } from '../database/mysqlClient';
import { db } from '../database/db';
import { INITIAL_CARS } from '../../constants';

const router = Router();

// Helper to get cars from JsonDatabase when MySQL is offline or not yet configured
const getJsonCars = (): any[] => {
  const raw = (db as any).getRawData ? (db as any).getRawData() : {};
  if (!Array.isArray(raw.cars)) {
    raw.cars = [];
  }
  if (raw.cars.length === 0 && Array.isArray(INITIAL_CARS) && INITIAL_CARS.length > 0) {
    raw.cars = JSON.parse(JSON.stringify(INITIAL_CARS));
    if ((db as any).rawSave) (db as any).rawSave();
  }
  return raw.cars;
};

const saveJsonCars = (cars: any[]) => {
  const raw = (db as any).getRawData ? (db as any).getRawData() : {};
  raw.cars = cars;
  if ((db as any).rawSave) (db as any).rawSave();
};

// Helper to check DB ready
const checkDb = (res: Response) => {
  if (!dbManager.hasPool()) {
    res.status(503).json({ success: false, error: 'قاعدة البيانات MySQL غير متصلة. يرجى التأكد من تشغيل الخادم والإعدادات.' });
    return false;
  }
  return true;
};

// Mapper: database row -> Frontend Car object
export const mapRowToCar = (row: any, exitData?: any, history?: any[], customFields?: Record<string, any>) => {
  if (!row) return null;
  const vin = row.vin || '';
  const rawVinMatching = String(row.vin_matching || '').trim();
  let vinMatching = 'متطابق';
  if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
    vinMatching = 'غير متطابق';
  } else {
    vinMatching = 'متطابق';
  }
  
  const plateData = row.plate_number ? {
    plateNumber: row.plate_number,
    ownerName: row.plate_owner_name || '',
    serialNumber: row.plate_serial_number || '',
    issueDate: row.plate_issue_date ? String(row.plate_issue_date).split('T')[0] : ''
  } : undefined;

  return {
    id: String(row.id),
    brand: row.brand || '',
    model: row.model || '',
    year: parseInt(row.year || new Date().getFullYear().toString(), 10),
    color: row.color || '',
    vin: vin,
    vinMatching: vinMatching,
    cardNumber: row.card_number || '',
    price: parseFloat(row.price || '0'),
    costPrice: parseFloat(row.cost_price || '0'),
    supplier: row.supplier || '',
    ownershipType: row.ownership_type || 'مباشر',
    status: row.status || 'متوفره',
    rentalStatus: row.rental_status || 'لم يتم التجير',
    entryDate: row.entry_date ? String(row.entry_date).split('T')[0] : new Date().toISOString().split('T')[0],
    attributionSource: row.attribution_source || undefined,
    isPresentInShowroom: row.is_present_in_showroom !== 0 && row.is_present_in_showroom !== false,
    presenceDescription: row.presence_description || (customFields && customFields.presenceDescription) || undefined,
    isOutbound: Boolean(row.is_outbound),
    hasPlate: Boolean(row.has_plate || row.plate_number),
    plateData: plateData,
    cardFile: row.card_file || undefined,
    cardFileName: row.card_file_name || undefined,
    statusNote: row.status_note || undefined,
    carRemark: row.car_remark || undefined,
    notes: row.notes || undefined,
    seller: row.seller || undefined,
    modelYear: row.model_year || undefined,
    exitType: row.exit_type || undefined,
    transferSender: row.transfer_sender || undefined,
    transferReceiver: row.transfer_receiver || undefined,
    transferNo: row.transfer_no || undefined,
    transferDate: row.transfer_date ? String(row.transfer_date) : undefined,
    reservedByUserId: row.reserved_by_user_id || undefined,
    reservationDate: row.reservation_date ? String(row.reservation_date) : undefined,
    lastModified: row.updated_at ? String(row.updated_at) : (row.created_at ? String(row.created_at) : new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : (row.created_at ? String(row.created_at) : new Date().toISOString()),
    exitData: exitData || undefined,
    history: history || [],
    customData: customFields || {}
  };
};

// 1. GET all cars with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { branch_id, status, search } = req.query;

    if (!dbManager.hasPool()) {
      let cars = getJsonCars();
      if (status && status !== 'all') {
        cars = cars.filter((c: any) => c.status === status);
      }
      if (branch_id && branch_id !== 'all') {
        cars = cars.filter((c: any) => !c.branchId || c.branchId === branch_id);
      }
      if (search) {
        const s = String(search).toLowerCase();
        cars = cars.filter((c: any) => 
          (c.vin && String(c.vin).toLowerCase().includes(s)) ||
          (c.vinMatching && String(c.vinMatching).toLowerCase().includes(s)) ||
          (c.brand && String(c.brand).toLowerCase().includes(s)) ||
          (c.model && String(c.model).toLowerCase().includes(s)) ||
          (c.cardNumber && String(c.cardNumber).toLowerCase().includes(s)) ||
          (c.plateData?.plateNumber && String(c.plateData.plateNumber).toLowerCase().includes(s))
        );
      }
      return res.json({ success: true, data: cars, cars: cars, count: cars.length });
    }

    const pool = dbManager.getPool();

    let sql = 'SELECT * FROM cars WHERE 1=1';
    const params: any[] = [];

    if (branch_id && branch_id !== 'all') {
      sql += ' AND (branch_id = ? OR branch_id IS NULL)';
      params.push(branch_id);
    }

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (vin LIKE ? OR vin_matching LIKE ? OR brand LIKE ? OR model LIKE ? OR plate_number LIKE ? OR card_number LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows]: any = await pool.query(sql, params);

    // Fetch exit data, custom fields, history for retrieved cars
    const cars = await Promise.all((rows || []).map(async (row: any) => {
      try {
        const [exitRows]: any = await pool.query('SELECT * FROM car_exit_data WHERE car_id = ?', [row.id]);
        const [customRows]: any = await pool.query('SELECT field_key, field_value FROM car_custom_fields WHERE car_id = ?', [row.id]);
        const [histRows]: any = await pool.query('SELECT * FROM car_history WHERE car_id = ? ORDER BY timestamp DESC', [row.id]);

        const customMap = (customRows || []).reduce((acc: any, curr: any) => {
          acc[curr.field_key] = curr.field_value;
          return acc;
        }, {});

        const exitData = exitRows && exitRows.length > 0 ? {
          receiverName: exitRows[0].receiver_name || '',
          receiverPhone: exitRows[0].receiver_phone || '',
          receiverId: exitRows[0].receiver_id || '',
          nationality: exitRows[0].nationality || '',
          deliveryType: exitRows[0].delivery_type || 'صاحبها',
          transportCompany: exitRows[0].transport_company || '',
          exitDate: exitRows[0].exit_date ? String(exitRows[0].exit_date) : '',
          notes: exitRows[0].notes || '',
          seller: exitRows[0].seller || '',
          saleType: exitRows[0].sale_type || '',
          bankName: exitRows[0].bank_name || '',
          representativeName: exitRows[0].representative_name || '',
          carCondition: exitRows[0].car_condition || ''
        } : undefined;

        return mapRowToCar(row, exitData, histRows || [], customMap);
      } catch {
        return mapRowToCar(row);
      }
    }));

    res.json({ success: true, data: cars, cars: cars, count: cars.length });
  } catch (err: any) {
    console.error('Error fetching cars:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET single car by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      const car = cars.find((c: any) => String(c.id) === String(id));
      if (!car) {
        return res.status(404).json({ success: false, error: 'السيارة غير موجودة في قاعدة البيانات.' });
      }
      return res.json({ success: true, data: car, car: car });
    }

    const pool = dbManager.getPool();

    const [carRows]: any = await pool.query('SELECT * FROM cars WHERE id = ?', [id]);
    if (!carRows || carRows.length === 0) {
      return res.status(404).json({ success: false, error: 'السيارة غير موجودة في قاعدة البيانات.' });
    }

    const row = carRows[0];
    const [exitRows]: any = await pool.query('SELECT * FROM car_exit_data WHERE car_id = ?', [id]);
    const [historyRows]: any = await pool.query('SELECT * FROM car_history WHERE car_id = ? ORDER BY timestamp DESC', [id]);
    const [customRows]: any = await pool.query('SELECT field_key, field_value FROM car_custom_fields WHERE car_id = ?', [id]);

    const customMap = (customRows || []).reduce((acc: any, curr: any) => {
      acc[curr.field_key] = curr.field_value;
      return acc;
    }, {});

    const exitData = exitRows && exitRows.length > 0 ? {
      receiverName: exitRows[0].receiver_name || '',
      receiverPhone: exitRows[0].receiver_phone || '',
      receiverId: exitRows[0].receiver_id || '',
      nationality: exitRows[0].nationality || '',
      deliveryType: exitRows[0].delivery_type || 'صاحبها',
      transportCompany: exitRows[0].transport_company || '',
      exitDate: exitRows[0].exit_date ? String(exitRows[0].exit_date) : '',
      notes: exitRows[0].notes || '',
      seller: exitRows[0].seller || '',
      saleType: exitRows[0].sale_type || '',
      bankName: exitRows[0].bank_name || '',
      representativeName: exitRows[0].representative_name || '',
      carCondition: exitRows[0].car_condition || ''
    } : undefined;

    const car = mapRowToCar(row, exitData, historyRows || [], customMap);
    res.json({ success: true, data: car, car: car });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST create new car
router.post('/', async (req: Request, res: Response) => {
  try {
    const car = req.body;

    if (!car.vin || !car.brand || !car.model) {
      return res.status(400).json({ success: false, error: 'رقم الهيكل، الشركة المصنعة، والموديل حقول مطلوبة.' });
    }

    const cleanVin = String(car.vin).trim().toUpperCase();
    const carId = car.id || `CAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const rawVinMatching = String(car.vinMatching || car.vin_matching || '').trim();
    let vinMatching = 'متطابق';
    if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
      vinMatching = 'غير متطابق';
    } else {
      vinMatching = 'متطابق';
    }

    const plateData = car.plateData || {};
    const plateNumber = car.plateNumber || plateData.plateNumber || null;
    const plateOwnerName = plateData.ownerName || null;
    const plateSerialNumber = plateData.serialNumber || null;
    const plateIssueDate = plateData.issueDate || null;
    const hasPlate = car.hasPlate || Boolean(plateNumber) ? 1 : 0;

    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      const existing = cars.find((c: any) => String(c.vin).trim().toUpperCase() === cleanVin);
      if (existing) {
        return res.status(409).json({ success: false, error: `رقم الهيكل ${cleanVin} مسجل مسبقاً في قاعدة البيانات.` });
      }
      const newCar = {
        ...car,
        id: carId,
        vin: cleanVin,
        vinMatching,
        price: parseFloat(car.price || '0'),
        costPrice: parseFloat(car.costPrice || car.cost_price || '0'),
        hasPlate: Boolean(hasPlate),
        plateData: plateNumber ? {
          plateNumber,
          ownerName: plateOwnerName || '',
          serialNumber: plateSerialNumber || '',
          issueDate: plateIssueDate || ''
        } : undefined,
        entryDate: car.entryDate || car.entry_date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      cars.unshift(newCar);
      saveJsonCars(cars);
      return res.json({ success: true, message: 'تم حفظ السيارة بنجاح', data: newCar, car: newCar });
    }

    const pool = dbManager.getPool();

    // Check duplicate VIN
    const [existing]: any = await pool.query('SELECT id FROM cars WHERE vin = ?', [cleanVin]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: `رقم الهيكل ${cleanVin} مسجل مسبقاً في قاعدة البيانات.` });
    }

    await pool.query(`
      INSERT INTO cars (
        id, tenant_id, branch_id, brand, model, year, color, vin, vin_matching,
        card_number, price, cost_price, supplier, ownership_type, status, rental_status,
        entry_date, attribution_source, is_present_in_showroom, is_outbound, has_plate,
        plate_number, plate_owner_name, plate_serial_number, plate_issue_date,
        card_file, card_file_name, status_note, car_remark, notes, seller, model_year,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      carId,
      car.tenant_id || car.tenantId || 'org-default',
      car.branch_id || car.branchId || 'branch-main',
      car.brand,
      car.model,
      parseInt(car.year || new Date().getFullYear().toString(), 10),
      car.color || '',
      cleanVin,
      vinMatching,
      car.cardNumber || car.card_number || null,
      parseFloat(car.price || '0'),
      parseFloat(car.costPrice || car.cost_price || '0'),
      car.supplier || null,
      car.ownershipType || car.ownership_type || 'مباشر',
      car.status || 'متوفره',
      car.rentalStatus || car.rental_status || 'لم يتم التجير',
      car.entryDate || car.entry_date || new Date().toISOString().split('T')[0],
      car.attributionSource || car.attribution_source || null,
      car.isPresentInShowroom !== false ? 1 : 0,
      car.isOutbound ? 1 : 0,
      hasPlate,
      plateNumber,
      plateOwnerName,
      plateSerialNumber,
      plateIssueDate,
      car.cardFile || car.card_file || null,
      car.cardFileName || car.card_file_name || null,
      car.statusNote || car.status_note || null,
      car.carRemark || car.car_remark || null,
      car.notes || null,
      car.seller || null,
      car.modelYear || car.model_year || null
    ]);

    // Save custom fields if present
    if (car.customData && typeof car.customData === 'object') {
      for (const [key, val] of Object.entries(car.customData)) {
        await pool.query(
          'INSERT INTO car_custom_fields (car_id, field_key, field_value) VALUES (?, ?, ?)',
          [carId, key, String(val)]
        ).catch(() => {});
      }
    }

    // Save initial movement
    await pool.query(`
      INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, new_status, user, details, timestamp)
      VALUES (?, ?, ?, ?, ?, 'إضافة سيارة', ?, ?, ?, NOW())
    `, [
      `mov_${Date.now()}`,
      car.tenant_id || car.tenantId || 'org-default',
      car.branch_id || car.branchId || 'branch-main',
      carId,
      cleanVin,
      car.status || 'متوفره',
      car.created_by || car.user || 'النظام',
      `تم إدخال المركبة ${car.brand} ${car.model} للمخزون`
    ]).catch(() => {});

    // Construct response object
    const createdCar = {
      ...car,
      id: carId,
      vin: cleanVin,
      vinMatching: vinMatching,
      price: parseFloat(car.price || '0'),
      costPrice: parseFloat(car.costPrice || car.cost_price || '0'),
      hasPlate: Boolean(hasPlate),
      plateData: plateNumber ? {
        plateNumber,
        ownerName: plateOwnerName || '',
        serialNumber: plateSerialNumber || '',
        issueDate: plateIssueDate || ''
      } : undefined,
      lastModified: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.json({ success: true, message: 'تم حفظ السيارة في قاعدة بيانات MySQL بنجاح', data: createdCar, car: createdCar });
  } catch (err: any) {
    console.error('Error creating car in MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. PUT update car
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const car = req.body;

    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      let idx = cars.findIndex((c: any) => String(c.id) === String(id));
      if (idx === -1) {
        if (car.brand && car.vin) {
          const newCar = {
            id: String(id),
            brand: car.brand,
            model: car.model || '',
            year: car.year || new Date().getFullYear(),
            color: car.color || '',
            vin: String(car.vin).trim().toUpperCase(),
            price: Number(car.price || 0),
            costPrice: Number(car.costPrice || 0),
            status: car.status || 'متوفره',
            rentalStatus: car.rentalStatus || 'لم يتم التجير',
            ownershipType: car.ownershipType || 'مباشر',
            entryDate: car.entryDate || new Date().toISOString().split('T')[0],
            ...car,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          cars.push(newCar);
          saveJsonCars(cars);
          return res.json({ success: true, message: 'تم حفظ وتحديث بيانات السيارة بنجاح', data: newCar, car: newCar });
        }
        return res.status(404).json({ success: false, error: 'السيارة غير موجودة للتعديل.' });
      }
      const existingCar = cars[idx];
      const cleanVin = car.vin ? String(car.vin).trim().toUpperCase() : existingCar.vin;
      const rawVinMatching = String(car.vinMatching !== undefined ? car.vinMatching : (car.vin_matching !== undefined ? car.vin_matching : existingCar.vinMatching || '')).trim();
      let vinMatching = 'متطابق';
      if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
        vinMatching = 'غير متطابق';
      } else {
        vinMatching = 'متطابق';
      }

      cars[idx] = {
        ...existingCar,
        ...car,
        id: String(id),
        vin: cleanVin,
        vinMatching,
        lastModified: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveJsonCars(cars);
      return res.json({ success: true, message: 'تم تحديث بيانات السيارة بنجاح', data: cars[idx], car: cars[idx] });
    }

    const pool = dbManager.getPool();

    let [existing]: any = await pool.query('SELECT * FROM cars WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      if (car.brand && car.vin) {
        const cleanVin = String(car.vin).trim().toUpperCase();
        await pool.query(
          'INSERT INTO cars (id, brand, model, year, color, vin, price, cost_price, status, rental_status, ownership_type, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            car.brand,
            car.model || '',
            car.year || new Date().getFullYear(),
            car.color || '',
            cleanVin,
            Number(car.price || 0),
            Number(car.costPrice || 0),
            car.status || 'متوفره',
            car.rentalStatus || 'لم يتم التجير',
            car.ownershipType || 'مباشر',
            car.entryDate || new Date().toISOString().split('T')[0]
          ]
        );
        const [reFetched]: any = await pool.query('SELECT * FROM cars WHERE id = ?', [id]);
        if (reFetched && reFetched.length > 0) {
          existing = reFetched;
        }
      }
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, error: 'السيارة غير موجودة للتعديل.' });
      }
    }

    const cleanVin = car.vin ? String(car.vin).trim().toUpperCase() : existing[0].vin;
    const rawVinMatching = String(car.vinMatching !== undefined ? car.vinMatching : (car.vin_matching !== undefined ? car.vin_matching : existing[0].vin_matching || '')).trim();
    let vinMatching = 'متطابق';
    if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
      vinMatching = 'غير متطابق';
    } else {
      vinMatching = 'متطابق';
    }

    const plateData = car.plateData || {};
    const plateNumber = car.plateNumber ?? plateData.plateNumber ?? existing[0].plate_number;
    const plateOwnerName = plateData.ownerName ?? existing[0].plate_owner_name;
    const plateSerialNumber = plateData.serialNumber ?? existing[0].plate_serial_number;
    const plateIssueDate = plateData.issueDate ?? existing[0].plate_issue_date;
    const hasPlate = car.hasPlate !== undefined ? (car.hasPlate ? 1 : 0) : (plateNumber ? 1 : existing[0].has_plate);

    await pool.query(`
      UPDATE cars SET
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        year = COALESCE(?, year),
        color = COALESCE(?, color),
        vin = COALESCE(?, vin),
        vin_matching = COALESCE(?, vin_matching),
        card_number = COALESCE(?, card_number),
        price = COALESCE(?, price),
        cost_price = COALESCE(?, cost_price),
        supplier = COALESCE(?, supplier),
        ownership_type = COALESCE(?, ownership_type),
        status = COALESCE(?, status),
        rental_status = COALESCE(?, rental_status),
        entry_date = COALESCE(?, entry_date),
        attribution_source = COALESCE(?, attribution_source),
        is_present_in_showroom = COALESCE(?, is_present_in_showroom),
        is_outbound = COALESCE(?, is_outbound),
        has_plate = COALESCE(?, has_plate),
        plate_number = COALESCE(?, plate_number),
        plate_owner_name = COALESCE(?, plate_owner_name),
        plate_serial_number = COALESCE(?, plate_serial_number),
        plate_issue_date = COALESCE(?, plate_issue_date),
        card_file = COALESCE(?, card_file),
        card_file_name = COALESCE(?, card_file_name),
        status_note = COALESCE(?, status_note),
        car_remark = COALESCE(?, car_remark),
        notes = COALESCE(?, notes),
        seller = COALESCE(?, seller),
        model_year = COALESCE(?, model_year),
        updated_at = NOW()
      WHERE id = ?
    `, [
      car.brand,
      car.model,
      car.year ? parseInt(car.year, 10) : null,
      car.color,
      cleanVin,
      vinMatching,
      car.cardNumber ?? car.card_number,
      car.price !== undefined ? parseFloat(car.price) : null,
      car.costPrice !== undefined ? parseFloat(car.costPrice) : (car.cost_price !== undefined ? parseFloat(car.cost_price) : null),
      car.supplier,
      car.ownershipType ?? car.ownership_type,
      car.status,
      car.rentalStatus ?? car.rental_status,
      car.entryDate ?? car.entry_date,
      car.attributionSource ?? car.attribution_source,
      car.isPresentInShowroom !== undefined ? (car.isPresentInShowroom ? 1 : 0) : null,
      car.isOutbound !== undefined ? (car.isOutbound ? 1 : 0) : null,
      hasPlate,
      plateNumber,
      plateOwnerName,
      plateSerialNumber,
      plateIssueDate,
      car.cardFile ?? car.card_file,
      car.cardFileName ?? car.card_file_name,
      car.statusNote ?? car.status_note,
      car.carRemark ?? car.car_remark,
      car.notes,
      car.seller,
      car.modelYear ?? car.model_year,
      id
    ]);

    // Update custom fields if provided
    if (car.customData && typeof car.customData === 'object') {
      await pool.query('DELETE FROM car_custom_fields WHERE car_id = ?', [id]);
      for (const [key, val] of Object.entries(car.customData)) {
        await pool.query(
          'INSERT INTO car_custom_fields (car_id, field_key, field_value) VALUES (?, ?, ?)',
          [id, key, String(val)]
        ).catch(() => {});
      }
    }

    const updatedCar = {
      ...existing[0],
      ...car,
      id,
      vin: cleanVin,
      vinMatching: vinMatching,
      lastModified: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.json({ success: true, message: 'تم تحديث بيانات السيارة بنجاح في MySQL', data: updatedCar, car: updatedCar });
  } catch (err: any) {
    console.error('Error updating car in MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST Bulk Insert
router.post('/bulk-insert', async (req: Request, res: Response) => {
  try {
    const { cars } = req.body;
    if (!Array.isArray(cars) || cars.length === 0) {
      return res.status(400).json({ success: false, error: 'مصفوفة السيارات مطلوبة.' });
    }

    if (!dbManager.hasPool()) {
      const currentCars = getJsonCars();
      const insertedCars: any[] = [];
      for (const car of cars) {
        const cleanVin = String(car.vin || '').trim().toUpperCase();
        if (!cleanVin) continue;
        const carId = car.id || `CAR-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const rawVinMatching = String(car.vinMatching || car.vin_matching || '').trim();
        let vinMatching = 'متطابق';
        if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
          vinMatching = 'غير متطابق';
        } else {
          vinMatching = 'متطابق';
        }
        const newCar = {
          ...car,
          id: carId,
          vin: cleanVin,
          vinMatching,
          price: parseFloat(car.price || '0'),
          costPrice: parseFloat(car.costPrice || car.cost_price || '0'),
          entryDate: car.entryDate || car.entry_date || new Date().toISOString().split('T')[0]
        };
        currentCars.unshift(newCar);
        insertedCars.push(newCar);
      }
      saveJsonCars(currentCars);
      return res.json({ success: true, message: `تم حفظ عدد ${insertedCars.length} سيارة بنجاح`, data: insertedCars, cars: insertedCars });
    }

    const pool = dbManager.getPool();
    const insertedCars: any[] = [];

    await dbManager.transaction(async (conn) => {
      for (const car of cars) {
        const cleanVin = String(car.vin || '').trim().toUpperCase();
        if (!cleanVin) continue;
        const brand = String(car.brand || 'مركبة مستوردة').trim();
        const model = String(car.model || car.brand || '-').trim();
        const carId = car.id || `CAR-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const rawVinMatching = String(car.vinMatching || car.vin_matching || '').trim();
        let vinMatching = 'متطابق';
        if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
          vinMatching = 'غير متطابق';
        } else {
          vinMatching = 'متطابق';
        }

        await conn.query(`
          INSERT INTO cars (
            id, tenant_id, branch_id, brand, model, year, color, vin, vin_matching,
            card_number, price, cost_price, supplier, ownership_type, status, rental_status,
            entry_date, attribution_source, is_present_in_showroom, is_outbound, has_plate,
            plate_number, plate_owner_name, plate_serial_number, plate_issue_date,
            card_file, card_file_name, status_note, car_remark, notes, seller, model_year,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            brand = VALUES(brand),
            model = VALUES(model),
            price = VALUES(price),
            cost_price = VALUES(cost_price),
            status = VALUES(status),
            updated_at = NOW()
        `, [
          carId,
          car.tenant_id || car.tenantId || 'org-default',
          car.branch_id || car.branchId || 'branch-main',
          car.brand,
          car.model,
          parseInt(car.year || new Date().getFullYear().toString(), 10),
          car.color || '',
          cleanVin,
          vinMatching,
          car.cardNumber || car.card_number || null,
          parseFloat(car.price || '0'),
          parseFloat(car.costPrice || car.cost_price || '0'),
          car.supplier || null,
          car.ownershipType || car.ownership_type || 'مباشر',
          car.status || 'متوفره',
          car.rentalStatus || car.rental_status || 'لم يتم التجير',
          car.entryDate || car.entry_date || new Date().toISOString().split('T')[0],
          car.attributionSource || car.attribution_source || null,
          car.isPresentInShowroom !== false ? 1 : 0,
          car.isOutbound ? 1 : 0,
          car.hasPlate ? 1 : 0,
          car.plateNumber || car.plate_number || null,
          car.plateOwnerName || car.plate_owner_name || null,
          car.plateSerialNumber || car.plate_serial_number || null,
          car.plateIssueDate || car.plate_issue_date || null,
          car.cardFile || car.card_file || null,
          car.cardFileName || car.card_file_name || null,
          car.statusNote || car.status_note || null,
          car.carRemark || car.car_remark || null,
          car.notes || null,
          car.seller || null,
          car.modelYear || car.model_year || null
        ]);

        insertedCars.push({ ...car, id: carId, vin: cleanVin, vinMatching });
      }
    });

    res.json({ success: true, message: `تم حفظ عدد ${insertedCars.length} سيارة في MySQL بنجاح`, data: insertedCars, cars: insertedCars });
  } catch (err: any) {
    console.error('Error in bulk insert:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST Bulk Delete
router.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'معرفات السيارات للحذف مطلوبة.' });
    }

    if (!dbManager.hasPool()) {
      const idSet = new Set(ids.map(String));
      let cars = getJsonCars();
      cars = cars.filter((c: any) => !idSet.has(String(c.id)));
      saveJsonCars(cars);
      return res.json({ success: true, message: `تم حذف عدد ${ids.length} سيارة بنجاح.` });
    }

    const pool = dbManager.getPool();
    await pool.query('DELETE FROM cars WHERE id IN (?)', [ids]);
    await pool.query('DELETE FROM car_custom_fields WHERE car_id IN (?)', [ids]).catch(() => {});

    res.json({ success: true, message: `تم حذف عدد ${ids.length} سيارة بنجاح من MySQL.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST Atomic Reservation
router.post('/:id/reserve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { delegateName, customerName, customerPhone, depositAmount, notes, user } = req.body;

    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      const car = cars.find((c: any) => String(c.id) === String(id));
      if (!car) {
        return res.status(404).json({ success: false, error: 'السيارة غير موجودة.' });
      }
      car.status = 'محجوزة';
      car.statusNote = delegateName || 'حجز مندوب';
      car.reservationDate = new Date().toISOString();
      car.reservedByUserId = user || 'مستخدم';
      saveJsonCars(cars);
      return res.json({ success: true, message: 'تم حجز السيارة بنجاح', data: { reservationId: `res_${Date.now()}` } });
    }

    const result = await dbManager.transaction(async (conn) => {
      const [updateRes]: any = await conn.query(`
        UPDATE cars SET
          status = 'محجوزة',
          status_note = ?,
          reservation_date = NOW(),
          reserved_by_user_id = ?,
          updated_at = NOW()
        WHERE id = ? AND status IN ('متوفره', 'بالساحة')
      `, [delegateName || 'مندوب', user || 'مستخدم', id]);

      if (updateRes.affectedRows === 0) {
        throw new Error('السيارة محجوزة أو مباعة بالفعل من مستخدم آخر.');
      }

      const resId = `res_${Date.now()}`;
      await conn.query(`
        INSERT INTO reservations (id, car_id, delegate_name, customer_name, customer_phone, deposit_amount, status, notes, created_by_user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())
      `, [resId, id, delegateName || '', customerName || '', customerPhone || '', parseFloat(depositAmount || '0'), notes || '', user || '']);

      const [carRows]: any = await conn.query('SELECT vin FROM cars WHERE id = ?', [id]);
      const vin = carRows[0]?.vin || '';
      await conn.query(`
        INSERT INTO inventory_movements (id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
        VALUES (?, ?, ?, 'حجز سيارة', 'متوفره', 'محجوزة', ?, ?, NOW())
      `, [`mov_${Date.now()}`, id, vin, user || delegateName, `حجز لصالح ${customerName || 'عميل'} بواسطة ${delegateName || 'مندوب'}`]);

      return { reservationId: resId };
    });

    res.json({ success: true, message: 'تم حجز السيارة بنجاح', data: result });
  } catch (err: any) {
    res.status(409).json({ success: false, error: err.message });
  }
});

// 8. POST Cancel Reservation
router.post('/:id/cancel-reservation', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user, reason } = req.body;

    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      const car = cars.find((c: any) => String(c.id) === String(id));
      if (!car) {
        return res.status(404).json({ success: false, error: 'السيارة غير موجودة.' });
      }
      car.status = 'متوفره';
      car.statusNote = undefined;
      car.reservationDate = undefined;
      car.reservedByUserId = undefined;
      saveJsonCars(cars);
      return res.json({ success: true, message: 'تم إلغاء الحجز بنجاح وإعادة السيارة للمخزون' });
    }

    await dbManager.transaction(async (conn) => {
      await conn.query(`
        UPDATE cars SET
          status = 'متوفره',
          status_note = NULL,
          reservation_date = NULL,
          reserved_by_user_id = NULL,
          updated_at = NOW()
        WHERE id = ?
      `, [id]);

      await conn.query(`
        UPDATE reservations SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' [إلغاء: ', ?, ']')
        WHERE car_id = ? AND status = 'active'
      `, [reason || 'إلغاء من المستخدم', id]);

      const [carRows]: any = await conn.query('SELECT vin FROM cars WHERE id = ?', [id]);
      const vin = carRows[0]?.vin || '';
      await conn.query(`
        INSERT INTO inventory_movements (id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
        VALUES (?, ?, ?, 'إلغاء حجز', 'محجوزة', 'متوفره', ?, ?, NOW())
      `, [`mov_${Date.now()}`, id, vin, user || 'مستخدم', reason || 'تم إلغاء الحجز وإعادة السيارة للمخزون']);
    });

    res.json({ success: true, message: 'تم إلغاء الحجز بنجاح وإعادة السيارة للمخزون' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. DELETE car
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user, reason } = req.body || {};

    if (!dbManager.hasPool()) {
      let cars = getJsonCars();
      cars = cars.filter((c: any) => String(c.id) !== String(id));
      saveJsonCars(cars);
      return res.json({ success: true, message: 'تم حذف السيارة بنجاح' });
    }

    const pool = dbManager.getPool();

    const [carRows]: any = await pool.query('SELECT * FROM cars WHERE id = ?', [id]);
    if (!carRows || carRows.length === 0) {
      return res.status(404).json({ success: false, error: 'السيارة غير موجودة في قاعدة البيانات.' });
    }
    const car = carRows[0];

    await pool.query('DELETE FROM cars WHERE id = ?', [id]);
    await pool.query('DELETE FROM car_custom_fields WHERE car_id = ?', [id]).catch(() => {});
    await pool.query('DELETE FROM car_exit_data WHERE car_id = ?', [id]).catch(() => {});

    await pool.query(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, target_id, target_type, details, timestamp)
      VALUES (?, ?, ?, 'DELETE_CAR', ?, 'car', ?, NOW())
    `, [
      `log_del_${Date.now()}`,
      car.tenant_id || 'org-default',
      user || 'مشرف',
      id,
      `تم حذف السيارة ${car.brand} ${car.model} شاسيه ${car.vin}. السبب: ${reason || 'حذف يدوي'}`
    ]).catch(() => {});

    res.json({ success: true, message: 'تم حذف السيارة بنجاح من MySQL' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
