import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CustomerEquipment, ICustomerEquipment, IEquipmentHistoryEntry } from '../models/CustomerEquipment';
import { ServiceBooking } from '../models/ServiceBooking';
import { Technician } from '../models/Technician';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';
import { isHttpUrl } from '../services/bookingRules';

const HISTORY_TYPES = ['installation', 'inspection', 'refilling', 'repair', 'maintenance'] as const;
const CONDITIONS = ['optimal', 'fair', 'damaged', 'needs_replacement'] as const;
const ADMIN_ROLES = ['super_admin', 'admin'];

function short(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s ? s.slice(0, max) : undefined;
}

function validDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? undefined : d;
}

export const listMyEquipment = asyncHandler(async (req: Request, res: Response) => {
  const equipment = await CustomerEquipment.find({ user: req.user!.id }).sort({ createdAt: -1 });
  const withStatus = equipment.map((e) => ({ ...e.toObject(), status: e.computeStatus() }));
  return ok(res, withStatus);
});

export const getMyEquipment = asyncHandler(async (req: Request, res: Response) => {
  const equipment = await CustomerEquipment.findOne({ _id: req.params.id, user: req.user!.id });
  if (!equipment) throw ApiError.notFound('Equipment not found');
  if (!equipment.qrCode) await equipment.generateQrCode();
  return ok(res, { ...equipment.toObject(), status: equipment.computeStatus() });
});

export const registerEquipment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const equipment = await CustomerEquipment.create({
    user: req.user!.id,
    product: body.productId || null,
    productNameSnapshot: short(body.productNameSnapshot, 200),
    serialNumber: String(body.serialNumber).toUpperCase().trim().slice(0, 60),
    capacity: short(body.capacity, 30) || '6 kg',
    fireClass: Array.isArray(body.fireClass) ? body.fireClass.map((c: unknown) => String(c).slice(0, 2)).slice(0, 6) : ['A', 'B', 'C'],
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
    installationDate: body.installationDate ? new Date(body.installationDate) : undefined,
    installationLocation: short(body.installationLocation, 300),
    lastInspectionDate: body.lastInspectionDate ? new Date(body.lastInspectionDate) : undefined,
    lastRefillDate: body.lastRefillDate ? new Date(body.lastRefillDate) : undefined,
    nextInspectionDate: body.nextInspectionDate ? new Date(body.nextInspectionDate) : undefined,
    nextRefillDate: body.nextRefillDate ? new Date(body.nextRefillDate) : undefined,
    notes: short(body.notes, 1000)
  });
  await equipment.generateQrCode();
  await equipment.save();

  return created(res, { ...equipment.toObject(), status: equipment.computeStatus() }, 'Equipment registered');
});

export const updateMyEquipment = asyncHandler(async (req: Request, res: Response) => {
  const equipment = await CustomerEquipment.findOne({ _id: req.params.id, user: req.user!.id });
  if (!equipment) throw ApiError.notFound('Equipment not found');

  const editable = [
    'productNameSnapshot', 'serialNumber', 'capacity', 'fireClass', 'purchaseDate', 'installationDate',
    'installationLocation', 'lastInspectionDate', 'lastRefillDate', 'nextInspectionDate', 'nextRefillDate', 'notes'
  ];
  const dateKeys = new Set(['purchaseDate', 'installationDate', 'lastInspectionDate', 'lastRefillDate', 'nextInspectionDate', 'nextRefillDate']);
  for (const key of editable) {
    const value = req.body[key];
    if (value === undefined) continue;
    if (dateKeys.has(key)) {
      const d = validDate(value);
      if (value !== null && value !== '' && !d) throw ApiError.badRequest(`Invalid date for ${key}`);
      (equipment as any)[key] = d;
    } else if (key === 'fireClass') {
      if (!Array.isArray(value)) throw ApiError.badRequest('fireClass must be a list');
      equipment.fireClass = value.map((c: unknown) => String(c).slice(0, 2)).slice(0, 6);
    } else if (key === 'serialNumber') {
      equipment.serialNumber = String(value).toUpperCase().trim().slice(0, 60);
    } else {
      (equipment as any)[key] = short(value, key === 'notes' ? 1000 : 300);
    }
  }
  await equipment.save();
  return ok(res, { ...equipment.toObject(), status: equipment.computeStatus() }, 'Equipment updated');
});

// ---------- Equipment Passport (QR Code Scan) ----------

/**
 * What an anonymous person who scans the sticker is allowed to see. The serial number is printed on the
 * extinguisher, so this view must hold nothing private: no owner name/phone/email, no site address, no
 * free-text notes, and no report links (service reports contain the customer's name, address, phone and
 * signature).
 */
function toPublicPassport(equipment: ICustomerEquipment & { user?: unknown }) {
  const owner = equipment.user as { companyName?: string } | null | undefined;
  const o = equipment.toObject();
  return {
    _id: o._id,
    productNameSnapshot: o.productNameSnapshot,
    serialNumber: o.serialNumber,
    capacity: o.capacity,
    fireClass: o.fireClass,
    purchaseDate: o.purchaseDate,
    installationDate: o.installationDate,
    lastInspectionDate: o.lastInspectionDate,
    lastRefillDate: o.lastRefillDate,
    nextInspectionDate: o.nextInspectionDate,
    nextRefillDate: o.nextRefillDate,
    qrCode: o.qrCode,
    status: equipment.computeStatus(),
    // Business name only, and only when the owner is a company.
    user: owner?.companyName ? { companyName: owner.companyName } : undefined,
    serviceHistory: ((o.serviceHistory || []) as IEquipmentHistoryEntry[]).map((h) => ({
      _id: h._id,
      date: h.date,
      type: h.type,
      pressureReading: h.pressureReading,
      physicalCondition: h.physicalCondition,
      sealIntact: h.sealIntact
    }))
  };
}

export const getEquipmentPassport = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const normalized = String(identifier).trim().toUpperCase().slice(0, 80);

  const equipment = await CustomerEquipment.findOne({
    $or: [{ serialNumber: normalized }, { _id: /^[0-9a-fA-F]{24}$/.test(identifier) ? identifier : null }]
  }).populate('user', 'name companyName phone email');

  if (!equipment) {
    throw ApiError.notFound('No equipment passport found for that serial number');
  }

  if (!equipment.qrCode) {
    await equipment.generateQrCode();
    await equipment.save();
  }

  // The owner and authorised staff get the full record; everyone else gets the public view.
  // A technician is only "authorised" for equipment on a job that is currently assigned to them, so one
  // technician cannot browse every customer's contact details by typing serial numbers.
  const ownerId = (equipment.user as unknown as { _id?: Types.ObjectId })?._id?.toString();
  const viewer = req.user;
  const isOwner = !!viewer && ownerId === viewer.id;
  let isStaff = !!viewer && (ADMIN_ROLES.includes(viewer.role) || (viewer.role !== 'technician' && viewer.permissions.includes('equipment.read')));
  if (viewer && viewer.role === 'technician' && !isStaff) {
    const technician = await Technician.findOne({ user: viewer.id, status: 'active' }).select('_id');
    if (technician) {
      isStaff = !!(await ServiceBooking.exists({
        equipment: equipment._id,
        assignedTechnician: technician._id,
        status: { $in: ['assigned', 'technician_on_the_way', 'in_progress'] }
      }));
    }
  }

  if (isOwner || isStaff) {
    return ok(res, { ...equipment.toObject(), status: equipment.computeStatus() }, 'Equipment passport retrieved');
  }
  return ok(res, toPublicPassport(equipment), 'Equipment passport retrieved');
});

/**
 * Records a service event on an equipment passport.
 *  - Admins can record on any equipment.
 *  - Technicians can only record against a booking that is assigned to them AND linked to this equipment.
 *  - The technician name always comes from the server, never from the request body.
 */
export const logPassportService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid equipment id');

  const type = req.body.type;
  if (!HISTORY_TYPES.includes(type)) throw ApiError.badRequest(`type must be one of: ${HISTORY_TYPES.join(', ')}`);
  const physicalCondition = CONDITIONS.includes(req.body.physicalCondition) ? req.body.physicalCondition : 'optimal';
  if (req.body.reportUrl !== undefined && req.body.reportUrl !== '' && !isHttpUrl(req.body.reportUrl)) {
    throw ApiError.badRequest('reportUrl must be a valid http(s) link');
  }
  const nextDate = validDate(req.body.nextDate);
  if (req.body.nextDate && !nextDate) throw ApiError.badRequest('nextDate is not a valid date');

  const equipment = await CustomerEquipment.findById(id);
  if (!equipment) throw ApiError.notFound('Equipment not found');

  const isAdmin = ADMIN_ROLES.includes(req.user!.role);
  let recordedBy = 'Staff';
  let bookingId: Types.ObjectId | null = null;

  if (isAdmin) {
    const actor = await User.findById(req.user!.id).select('name');
    recordedBy = actor?.name || 'Staff';
  } else {
    const technician = await Technician.findOne({ user: req.user!.id, status: 'active' });
    if (!technician) throw ApiError.forbidden('Only technicians and administrators can record service events');
    if (!Types.ObjectId.isValid(String(req.body.bookingId))) {
      throw ApiError.badRequest('bookingId of your assigned job is required');
    }
    const booking = await ServiceBooking.findOne({
      _id: req.body.bookingId,
      assignedTechnician: technician._id,
      equipment: equipment._id,
      status: { $in: ['assigned', 'technician_on_the_way', 'in_progress'] }
    });
    if (!booking) throw ApiError.forbidden('You can only record events for equipment on a job assigned to you');
    recordedBy = technician.name;
    bookingId = booking._id;
  }

  const now = new Date();
  equipment.serviceHistory.push({
    date: now,
    type,
    technicianName: recordedBy,
    pressureReading: short(req.body.pressureReading, 60),
    physicalCondition,
    sealIntact: req.body.sealIntact !== undefined ? Boolean(req.body.sealIntact) : true,
    bookingId,
    notes: short(req.body.notes, 1000),
    reportUrl: req.body.reportUrl || undefined
  });

  if (type === 'refilling') {
    equipment.lastRefillDate = now;
    if (nextDate) equipment.nextRefillDate = nextDate;
  } else if (type === 'inspection') {
    equipment.lastInspectionDate = now;
    if (nextDate) equipment.nextInspectionDate = nextDate;
  }

  await equipment.save();
  await writeAuditLog(req, 'log_service_event', 'equipment', 'CustomerEquipment', equipment._id, null, {
    type, bookingId, serialNumber: equipment.serialNumber
  });

  return ok(res, { ...equipment.toObject(), status: equipment.computeStatus() }, 'Service event recorded in equipment passport');
});

// ---------- Admin ----------

export const adminListEquipment = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.userId && Types.ObjectId.isValid(String(req.query.userId))) filter.user = String(req.query.userId);
  const equipment = await CustomerEquipment.find(filter).populate('user', 'name email phone').sort({ nextRefillDate: 1 });
  const withStatus = equipment.map((e) => ({ ...e.toObject(), status: e.computeStatus() }));
  return ok(res, withStatus);
});

export const adminDueEquipment = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const equipment = await CustomerEquipment.find({
    $or: [{ nextInspectionDate: { $lte: cutoff } }, { nextRefillDate: { $lte: cutoff } }]
  }).populate('user', 'name email phone');
  const withStatus = equipment.map((e) => ({ ...e.toObject(), status: e.computeStatus() }));
  return ok(res, withStatus);
});
