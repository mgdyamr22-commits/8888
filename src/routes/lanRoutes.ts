import { Router, Request, Response } from 'express';
import { db } from '../database/db';

const router = Router();

/**
 * GET /api/lan/data & /api/lan/data.php
 * Fetches all central synced data for LAN / desktop / cloud clients.
 */
router.get(['/data', '/data.php'], (req: Request, res: Response) => {
  try {
    const raw = (db as any).getRawData ? (db as any).getRawData() : {};

    return res.json({
      success: true,
      cars: Array.isArray(raw.cars) ? raw.cars : [],
      customers: Array.isArray(raw.customers) ? raw.customers : [],
      logs: Array.isArray(raw.logHistory) ? raw.logHistory : (Array.isArray(raw.logs) ? raw.logs : []),
      settings: raw.settings || null,
      lettersArchive: Array.isArray(raw.lettersArchive) ? raw.lettersArchive : [],
      vehicleCosts: Array.isArray(raw.vehicleCosts) ? raw.vehicleCosts : [],
      inventoryMovements: Array.isArray(raw.inventoryMovements) ? raw.inventoryMovements : [],
      sisterCompanies: Array.isArray(raw.companies) ? raw.companies : (Array.isArray(raw.sisterCompanies) ? raw.sisterCompanies : []),
      companyTransfers: Array.isArray(raw.companyTransfers) ? raw.companyTransfers : [],
      companyTransfersSettings: raw.companyTransfersSettings || null,
      delegates: Array.isArray(raw.delegates) ? raw.delegates : []
    });
  } catch (err: any) {
    console.error('Error fetching LAN data:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات المزامنة المركزية.'
    });
  }
});

/**
 * POST /api/lan/sync & /api/lan/sync.php
 * Synchronizes client payload with server storage.
 */
router.post(['/sync', '/sync.php'], (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const raw = (db as any).getRawData ? (db as any).getRawData() : {};

    if (Array.isArray(body.cars)) {
      raw.cars = body.cars;
    }
    if (Array.isArray(body.customers)) {
      raw.customers = body.customers;
    }
    if (Array.isArray(body.logs)) {
      raw.logs = body.logs;
    }
    if (body.settings && typeof body.settings === 'object') {
      raw.settings = body.settings;
    }
    if (Array.isArray(body.lettersArchive)) {
      raw.lettersArchive = body.lettersArchive;
    }
    if (Array.isArray(body.vehicleCosts)) {
      raw.vehicleCosts = body.vehicleCosts;
    }
    if (Array.isArray(body.inventoryMovements)) {
      raw.inventoryMovements = body.inventoryMovements;
    }
    if (Array.isArray(body.sisterCompanies)) {
      raw.sisterCompanies = body.sisterCompanies;
    }
    if (Array.isArray(body.companyTransfers)) {
      raw.companyTransfers = body.companyTransfers;
    }
    if (body.companyTransfersSettings && typeof body.companyTransfersSettings === 'object') {
      raw.companyTransfersSettings = body.companyTransfersSettings;
    }
    if (Array.isArray(body.delegates)) {
      raw.delegates = body.delegates;
    }

    if (typeof (db as any).rawSave === 'function') {
      (db as any).rawSave();
    }

    return res.json({
      success: true,
      message: 'تمت مزامنة وحفظ بيانات الشبكة المركزية بنجاح.',
      cars: Array.isArray(raw.cars) ? raw.cars : (Array.isArray(body.cars) ? body.cars : [])
    });
  } catch (err: any) {
    console.error('Error syncing LAN data:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل في حفظ وتحديث بيانات المزامنة المركزية.'
    });
  }
});

export default router;
