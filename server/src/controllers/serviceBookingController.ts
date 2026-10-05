import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ServiceBooking, ServiceStatus, IServiceBooking } from '../models/ServiceBooking';
import { Technician, ITechnician } from '../models/Technician';
import { User } from '../models/User';
import { CustomerEquipment } from '../models/CustomerEquipment';
import { Setting } from '../models/AuditLog';
import { Service } from '../models/Service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';
import { ok, created, paginationMeta } from '../utils/apiResponse';
import { nextNumber } from '../services/numberingService';
import { notify } from '../services/notificationService';
import { emailTemplates } from '../services/emailService';
import { writeAuditLog } from '../services/auditService';
import { generateServiceReportPdf } from '../services/pdfService';
import { logger } from '../config/logger';
import {
  STANDARD_SLOTS,
  OPEN_STATUSES,
  TECHNICIAN_SETTABLE,
  INSPECTION_INTERVAL_DAYS,
  REFILL_INTERVAL_DAYS,
  isValidSlot,
  dayRangeUtc,
  parseBookingDate,
  assertNotInPast,
  slotCapacity,
  countBookedInSlot,
  assertSlotHasRoom,
  canTransition,
  historyTypeFor,
  dueDateUpdateFor,
  isHttpUrl,
  cleanUrlList,
  isSignatureDataUrl
} from '../services/bookingRules';

// ------------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------------

const ADMIN_ROLES = ['super_admin', 'admin'];
const PHYSICAL_CONDITIONS = ['optimal', 'fair', 'damaged', 'needs_replacement'] as const;
type PhysicalCondition = (typeof PHYSICAL_CONDITIONS)[number];

function assertObjectId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }
  return value;
}

function text(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s ? s.slice(0, max) : undefined;
}

async function findActiveTechnicianFor(userId: string): Promise<ITechnician | null> {
  return Technician.findOne({ user: userId, status: 'active' });
}

/**
 * Only admins, or the technician this job is assigned to, may act on a job (check-in, complete, set progress).
 * Being logged in is NOT enough: without this a customer could complete somebody else's booking.
 * Returns the technician profile when the actor is a technician.
 */
async function assertCanActOnJob(req: Request, booking: IServiceBooking): Promise<ITechnician | null> {
  if (ADMIN_ROLES.includes(req.user!.role)) return null;
  if (req.user!.role !== 'technician') throw ApiError.forbidden('Only the assigned technician can do this');

  const technician = await findActiveTechnicianFor(req.user!.id);
  if (!technician || !booking.assignedTechnician || booking.assignedTechnician.toString() !== technician._id.toString()) {
    throw ApiError.forbidden('This job is not assigned to you');
  }
  return technician;
}

async function resolveBookableService(serviceId?: string, serviceType?: string) {
  const bookable = { isDeleted: false, isActive: true, isPublished: true };

  if (serviceId) {
    assertObjectId(serviceId, 'service');
    const service = await Service.findOne({ _id: serviceId, ...bookable });
    if (!service) throw ApiError.badRequest('That service is not available for booking');
    return service;
  }

  const raw = (serviceType || '').trim();
  if (!raw) throw ApiError.badRequest('Choose a service to book');
  const slug = raw.toLowerCase().replace(/[_\s]+/g, '-');
  const service = await Service.findOne({
    ...bookable,
    // Escaped: serviceType comes from the client and must never be interpreted as a pattern.
    $or: [{ slug }, { name: new RegExp(`^${escapeRegex(raw.replace(/[_-]/g, ' '))}$`, 'i') }]
  });
  if (!service) throw ApiError.badRequest('Unknown or unavailable service');
  return service;
}

function addTimeline(
  booking: IServiceBooking,
  by: 'customer' | 'staff' | 'technician' | 'system',
  action: string,
  note?: string
) {
  booking.timeline.push({ at: new Date(), by, action, note });
}

// ------------------------------------------------------------------------------------------------
// Customer
// ------------------------------------------------------------------------------------------------

export const createServiceBooking = asyncHandler(async (req: Request, res: Response) => {
  const { serviceId, serviceType, phone, address, preferredDate, equipmentId, problemDescription, additionalNotes } = req.body;

  const slot = req.body.timeSlot || req.body.preferredTime;
  if (!isValidSlot(slot)) {
    throw ApiError.badRequest(`Choose one of the available time slots: ${STANDARD_SLOTS.map((s) => s.slot).join(', ')}`);
  }
  const date = parseBookingDate(preferredDate);
  assertNotInPast(date);

  const service = await resolveBookableService(serviceId, serviceType);

  // The equipment must belong to the person booking.
  let equipment = null;
  if (equipmentId) {
    assertObjectId(equipmentId, 'equipment');
    equipment = await CustomerEquipment.findOne({ _id: equipmentId, user: req.user!.id });
    if (!equipment) throw ApiError.notFound('Equipment not found on your account');
  }

  await assertSlotHasRoom(date, slot);

  const bookingNumber = await nextNumber('service', 'SRV');
  const booking = await ServiceBooking.create({
    bookingNumber,
    user: req.user!.id,
    service: service._id,
    serviceType: service.slug,
    phone,
    address,
    preferredDate: date,
    preferredTime: slot,
    timeSlot: slot,
    equipment: equipment ? equipment._id : null,
    problemDescription: text(problemDescription, 2000),
    additionalNotes: text(additionalNotes, 2000),
    status: 'requested',
    timeline: [{ at: new Date(), by: 'customer', action: 'requested' }]
  });

  // The check above and the insert are not one atomic step, so two people could grab the last place at the
  // same moment. Re-count after inserting; whoever pushes the slot over capacity backs out.
  const { capacity } = await slotCapacity();
  if ((await countBookedInSlot(date, slot)) > capacity) {
    await ServiceBooking.deleteOne({ _id: booking._id });
    throw new ApiError(409, 'That time slot was just taken. Please choose another slot.');
  }

  try {
    const user = await User.findById(req.user!.id);
    await notify({
      userId: req.user!.id,
      type: 'service_booking',
      title: 'Service Booking Received',
      message: `Your ${service.name} booking ${bookingNumber} has been received.`,
      email: user?.email,
      emailHtml: emailTemplates.serviceBooking(bookingNumber, service.name),
      phone
    });
  } catch (err) {
    logger.error({ err, bookingNumber }, '[bookings] Booking confirmation notification failed');
  }

  await writeAuditLog(req, 'create', 'service_bookings', 'ServiceBooking', booking._id, null, {
    bookingNumber,
    service: service._id,
    serviceType: service.slug
  });

  return created(res, booking, 'Service booking submitted');
});

export const myServiceBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await ServiceBooking.find({ user: req.user!.id })
    // adminNotes are internal staff notes and must never reach customers.
    .select('-adminNotes')
    .populate('service', 'name slug startingPrice priceUnit image')
    .populate('assignedTechnician', 'name phone')
    .sort({ createdAt: -1 });
  return ok(res, bookings);
});

export const customerRescheduleBooking = asyncHandler(async (req: Request, res: Response) => {
  const preferredDate = req.body.preferredDate || req.body.newDate;
  const requestedSlot = req.body.timeSlot || req.body.newTimeSlot;
  const reason = text(req.body.reason, 500);
  if (!preferredDate) throw ApiError.badRequest('New preferred date is required');
  assertObjectId(req.params.id, 'booking id');

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.user.toString() !== req.user!.id) {
    throw ApiError.forbidden('You can only reschedule your own bookings');
  }
  if (!['requested', 'confirmed', 'assigned'].includes(booking.status)) {
    throw ApiError.badRequest(`A booking that is '${booking.status}' can no longer be rescheduled`);
  }

  const date = parseBookingDate(preferredDate);
  assertNotInPast(date);
  const slot = requestedSlot || booking.timeSlot || booking.preferredTime;
  if (!isValidSlot(slot)) throw ApiError.badRequest('Choose one of the available time slots');

  // Capacity is enforced here too, not only at creation (excluding this booking's own current place).
  await assertSlotHasRoom(date, slot, booking._id);

  const prevDate = booking.preferredDate;
  const prevSlot = booking.timeSlot || booking.preferredTime;

  booking.preferredDate = date;
  booking.timeSlot = slot;
  booking.preferredTime = slot;
  addTimeline(
    booking,
    'customer',
    'rescheduled',
    `From ${prevDate.toISOString().slice(0, 10)} (${prevSlot || 'no slot'}) to ${date.toISOString().slice(0, 10)} (${slot})${reason ? `. Reason: ${reason}` : ''}`
  );
  await booking.save();

  await writeAuditLog(
    req, 'reschedule', 'services', 'ServiceBooking', booking._id,
    { preferredDate: prevDate, timeSlot: prevSlot },
    { preferredDate: booking.preferredDate, timeSlot: booking.timeSlot }
  );

  return ok(res, booking, 'Service booking rescheduled successfully');
});

export const customerCancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const reason = text(req.body?.reason, 500);
  assertObjectId(req.params.id, 'booking id');

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.user.toString() !== req.user!.id) {
    throw ApiError.forbidden('You can only cancel your own bookings');
  }
  // Once the technician is working on it, only staff can cancel.
  if (!['requested', 'confirmed', 'assigned', 'technician_on_the_way'].includes(booking.status)) {
    throw ApiError.badRequest(`A booking that is '${booking.status}' can no longer be cancelled`);
  }

  const previous = booking.toObject();
  booking.status = 'cancelled';
  addTimeline(booking, 'customer', 'cancelled', reason);
  await booking.save();

  await writeAuditLog(req, 'cancel', 'services', 'ServiceBooking', booking._id, previous, booking.toObject());
  return ok(res, booking, 'Service booking cancelled');
});

// ------------------------------------------------------------------------------------------------
// Slots
// ------------------------------------------------------------------------------------------------

export const getAvailableSlots = asyncHandler(async (req: Request, res: Response) => {
  const dateStr = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw ApiError.badRequest('Date parameter (YYYY-MM-DD) is required');
  }
  const queryDate = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(queryDate.getTime())) throw ApiError.badRequest('Invalid date');

  const { start, end } = dayRangeUtc(queryDate);
  const isPast = end.getTime() < dayRangeUtc(new Date()).start.getTime();
  const { capacity, activeTechnicians } = await slotCapacity();

  const booked = await ServiceBooking.find({
    preferredDate: { $gte: start, $lte: end },
    status: { $nin: ['cancelled', 'rejected'] }
  }).select('timeSlot preferredTime');

  const slots = STANDARD_SLOTS.map((s) => {
    const bookedCount = booked.filter((b) => b.timeSlot === s.slot || b.preferredTime === s.slot).length;
    const remaining = Math.max(0, capacity - bookedCount);
    return {
      slot: s.slot,
      label: s.label,
      period: s.period,
      capacity,
      bookedCount,
      remainingCapacity: remaining,
      isAvailable: !isPast && remaining > 0
    };
  });

  return ok(res, { date: dateStr, totalTechnicians: activeTechnicians, slots });
});

// ------------------------------------------------------------------------------------------------
// Staff
// ------------------------------------------------------------------------------------------------

export const adminListServiceBookings = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter: Record<string, unknown> = {};

  // Technicians see only their own assigned jobs, never the whole customer list.
  if (req.user!.role === 'technician') {
    const technician = await findActiveTechnicianFor(req.user!.id);
    if (!technician) return ok(res, [], 'Bookings fetched', paginationMeta(page, limit, 0));
    filter.assignedTechnician = technician._id;
  }

  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.serviceType) filter.serviceType = String(req.query.serviceType);
  if (req.query.service && Types.ObjectId.isValid(String(req.query.service))) filter.service = String(req.query.service);
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {};
    if (req.query.from) range.$gte = new Date(String(req.query.from));
    if (req.query.to) range.$lte = new Date(String(req.query.to));
    filter.preferredDate = range;
  }

  const [items, total] = await Promise.all([
    ServiceBooking.find(filter)
      .populate('user', 'name email phone')
      .populate('assignedTechnician', 'name phone')
      .populate('service', 'name slug startingPrice priceUnit')
      .sort({ preferredDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ServiceBooking.countDocuments(filter)
  ]);
  return ok(res, items, 'Bookings fetched', paginationMeta(page, limit, total));
});

export const adminAssignTechnician = asyncHandler(async (req: Request, res: Response) => {
  const technicianId = assertObjectId(req.body.technicianId, 'technician id');
  assertObjectId(req.params.id, 'booking id');

  const technician = await Technician.findOne({ _id: technicianId, status: 'active' });
  if (!technician) throw ApiError.notFound('Active technician not found');

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!canTransition(booking.status, 'assigned')) {
    throw ApiError.badRequest(`A booking that is '${booking.status}' cannot be assigned`);
  }

  const previousTechnician = booking.assignedTechnician;
  booking.assignedTechnician = technician._id;
  booking.status = 'assigned';
  addTimeline(booking, 'staff', 'assigned');
  await booking.save();

  await writeAuditLog(req, 'assign_technician', 'services', 'ServiceBooking', booking._id,
    { assignedTechnician: previousTechnician }, { assignedTechnician: technician._id });
  try {
    await notify({
      userId: booking.user, type: 'service_reminder', title: 'Technician Assigned',
      message: `A technician has been assigned to your booking ${booking.bookingNumber}.`
    });
  } catch (err) {
    logger.error({ err }, '[bookings] Technician-assigned notification failed');
  }

  return ok(res, booking, 'Technician assigned');
});

export const adminUpdateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: ServiceStatus };
  const adminNotes = text(req.body.adminNotes, 2000);
  assertObjectId(req.params.id, 'booking id');

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  const isTechnician = req.user!.role === 'technician';
  if (isTechnician) {
    // A technician may only move their own job forward (on the way / in progress).
    await assertCanActOnJob(req, booking);
    if (!TECHNICIAN_SETTABLE.includes(status)) {
      throw ApiError.forbidden('Technicians can only mark a job on the way or in progress. Use "complete" to finish it.');
    }
  }

  if (!canTransition(booking.status, status)) {
    throw ApiError.badRequest(`A booking cannot move from '${booking.status}' to '${status}'`);
  }
  if (status === 'assigned' && !booking.assignedTechnician) {
    throw ApiError.badRequest('Assign a technician before marking the booking as assigned');
  }
  if (status === 'completed' && !(booking.serviceReportUrl || booking.workSummary)) {
    throw ApiError.badRequest('A job cannot be marked completed without a service report. Complete it through the technician flow or upload a report first.');
  }

  const previous = booking.toObject();
  booking.status = status;
  if (status === 'completed') booking.completedAt = new Date();
  if (adminNotes && !isTechnician) booking.adminNotes = adminNotes;
  if (status !== previous.status) addTimeline(booking, isTechnician ? 'technician' : 'staff', status);
  await booking.save();

  await writeAuditLog(req, 'update_status', 'services', 'ServiceBooking', booking._id, previous, booking.toObject());
  return ok(res, booking, 'Booking status updated');
});

export const adminUploadServiceReport = asyncHandler(async (req: Request, res: Response) => {
  const { serviceReportUrl } = req.body;
  assertObjectId(req.params.id, 'booking id');
  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  if (serviceReportUrl !== undefined) {
    if (!isHttpUrl(serviceReportUrl)) throw ApiError.badRequest('Report URL must be a valid http(s) link');
    booking.serviceReportUrl = serviceReportUrl;
  }
  booking.beforePhotos.push(...cleanUrlList(req.body.beforePhotos));
  booking.afterPhotos.push(...cleanUrlList(req.body.afterPhotos));
  if (booking.beforePhotos.length > 20 || booking.afterPhotos.length > 20) {
    throw ApiError.badRequest('A booking can hold at most 20 before and 20 after photos');
  }
  await booking.save();

  return ok(res, booking, 'Service report saved');
});

// ------------------------------------------------------------------------------------------------
// Technician mobile flow
// ------------------------------------------------------------------------------------------------

export const technicianMyJobs = asyncHandler(async (req: Request, res: Response) => {
  const technician = await findActiveTechnicianFor(req.user!.id);
  if (!technician) throw ApiError.notFound('Technician profile not found for this account');

  const { start, end } = dayRangeUtc(new Date());
  const mine = { assignedTechnician: technician._id };

  const [todaysJobs, upcomingJobs, overdueJobs, completedJobs] = await Promise.all([
    ServiceBooking.find({
      ...mine,
      preferredDate: { $gte: start, $lte: end },
      status: { $nin: ['cancelled', 'rejected'] }
    }).sort({ timeSlot: 1 }),
    ServiceBooking.find({ ...mine, preferredDate: { $gt: end }, status: { $in: OPEN_STATUSES } }).sort({ preferredDate: 1 }),
    // Still-open jobs whose date has passed used to vanish from the list; surface them instead.
    ServiceBooking.find({ ...mine, preferredDate: { $lt: start }, status: { $in: OPEN_STATUSES } }).sort({ preferredDate: 1 }),
    ServiceBooking.find({ ...mine, status: 'completed' }).sort({ completedAt: -1, updatedAt: -1 }).limit(20)
  ]);

  return ok(res, { todaysJobs, upcomingJobs, overdueJobs, completedJobs });
});

export const technicianCheckIn = asyncHandler(async (req: Request, res: Response) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw ApiError.badRequest('Valid latitude and longitude are required for GPS check-in');
  }
  assertObjectId(req.params.id, 'booking id');

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  await assertCanActOnJob(req, booking);

  if (!['assigned', 'technician_on_the_way', 'in_progress'].includes(booking.status)) {
    throw ApiError.badRequest(`Cannot check in to a booking that is '${booking.status}'`);
  }

  booking.checkInLocation = {
    latitude,
    longitude,
    timestamp: new Date(),
    address: text(req.body.address, 300) || 'On-site verified'
  };
  if (booking.status !== 'in_progress') {
    booking.status = 'in_progress';
    addTimeline(booking, 'technician', 'in_progress', 'Checked in on site');
  }
  await booking.save();

  await writeAuditLog(req, 'technician_check_in', 'services', 'ServiceBooking', booking._id, null, {
    latitude, longitude, timestamp: booking.checkInLocation.timestamp
  });

  return ok(res, booking, 'Technician check-in recorded successfully');
});

export const technicianCompleteJob = asyncHandler(async (req: Request, res: Response) => {
  assertObjectId(req.params.id, 'booking id');

  const existing = await ServiceBooking.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Booking not found');
  const technician = await assertCanActOnJob(req, existing);

  const workSummary = text(req.body.workSummary, 4000);
  if (!workSummary) throw ApiError.badRequest('A work summary is required to complete the job');

  const customerSignature = req.body.customerSignature;
  if (customerSignature && !isSignatureDataUrl(customerSignature)) {
    throw ApiError.badRequest('The customer signature must be a PNG or JPEG image under 300 KB');
  }
  const physicalCondition: PhysicalCondition = PHYSICAL_CONDITIONS.includes(req.body.physicalCondition)
    ? req.body.physicalCondition
    : 'optimal';
  const pressureReading = text(req.body.pressureReading, 60);
  const sealIntact = req.body.sealIntact === undefined ? true : Boolean(req.body.sealIntact);
  const partsReplaced = Array.isArray(req.body.partsReplaced)
    ? (req.body.partsReplaced.map((p: unknown) => text(p, 100)).filter(Boolean).slice(0, 30) as string[])
    : [];

  // Atomic claim: only ONE request can move the job to completed, so a double-tap can never generate two
  // reports or write two equipment-history entries.
  const claimed = await ServiceBooking.findOneAndUpdate(
    { _id: existing._id, status: { $in: ['assigned', 'technician_on_the_way', 'in_progress'] } },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true }
  );
  if (!claimed) throw new ApiError(409, 'This job is already completed or can no longer be completed');

  const booking = await ServiceBooking.findById(claimed._id)
    .populate('user', 'name email phone')
    .populate('service', 'name slug startingPrice priceUnit')
    .populate('assignedTechnician', 'name phone')
    .populate('equipment');
  if (!booking) throw ApiError.notFound('Booking not found');

  const before = cleanUrlList(req.body.beforePhotos);
  const after = cleanUrlList(req.body.afterPhotos);
  if (before.length) booking.beforePhotos = before;
  if (after.length) booking.afterPhotos = after;
  if (customerSignature) booking.customerSignature = customerSignature;
  booking.workSummary = workSummary;
  if (pressureReading) booking.pressureReading = pressureReading;
  booking.sealIntact = sealIntact;
  booking.physicalCondition = physicalCondition;
  booking.partsReplaced = partsReplaced;
  addTimeline(booking, 'technician', 'completed');

  const companyDoc = await Setting.findOne({ key: 'company' });
  const companySettings = (companyDoc?.value as Record<string, string> | undefined) || {};
  const cName = companySettings.companyName || companySettings.name || 'Fire Safety Platform';
  const technicianName = technician?.name || (booking.assignedTechnician as unknown as { name?: string })?.name || 'Certified Technician';
  const bookedUser = booking.user as unknown as { _id: Types.ObjectId; name?: string; email?: string };
  const equipment = booking.equipment as unknown as { productNameSnapshot?: string; serialNumber?: string } | null;

  try {
    const pdfResult = await generateServiceReportPdf({
      company: {
        companyName: cName,
        name: cName,
        address: companySettings.address || '',
        phone: companySettings.phone || '',
        email: companySettings.email || ''
      },
      bookingNumber: booking.bookingNumber,
      serviceType: booking.serviceType,
      serviceName: (booking.service as unknown as { name?: string })?.name || booking.serviceType,
      date: new Date(),
      customer: {
        name: bookedUser?.name || 'Valued Customer',
        email: bookedUser?.email || '',
        phone: booking.phone || '',
        address: booking.address || ''
      },
      technician: {
        name: technicianName,
        phone: (booking.assignedTechnician as unknown as { phone?: string })?.phone || ''
      },
      equipment: equipment
        ? { name: equipment.productNameSnapshot || 'Fire Extinguisher', serialNumber: equipment.serialNumber || 'N/A' }
        : undefined,
      checkIn: booking.checkInLocation,
      workSummary,
      pressureReading: pressureReading || 'Not recorded',
      customerSignature,
      partsReplaced
    });
    booking.serviceReportUrl = pdfResult.url;
  } catch (pdfErr) {
    // The job IS completed; a failed PDF must not undo that. Staff can attach a report later.
    logger.error({ err: pdfErr, bookingNumber: booking.bookingNumber }, '[bookings] Service report PDF generation failed');
  }

  await booking.save();

  // Equipment history. Wrapped so a problem here can never turn a completed job into an error response.
  if (booking.equipment) {
    try {
      const equipId = (booking.equipment as unknown as { _id: Types.ObjectId })._id;
      const equip = await CustomerEquipment.findById(equipId);
      if (equip && equip.user.toString() === bookedUser._id.toString()) {
        const type = historyTypeFor(booking.serviceType);
        const now = new Date();
        equip.serviceHistory.push({
          date: now,
          type,
          technicianName,
          pressureReading: pressureReading || 'Not recorded',
          physicalCondition,
          sealIntact,
          bookingId: booking._id,
          notes: workSummary,
          reportUrl: booking.serviceReportUrl
        });
        const due = dueDateUpdateFor(type);
        if (due.inspection) {
          equip.lastInspectionDate = now;
          equip.nextInspectionDate = new Date(now.getTime() + INSPECTION_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
        }
        if (due.refill) {
          equip.lastRefillDate = now;
          equip.nextRefillDate = new Date(now.getTime() + REFILL_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
        }
        await equip.save();
      }
    } catch (err) {
      logger.error({ err, bookingNumber: booking.bookingNumber }, '[bookings] Equipment history update failed after completion');
    }
  }

  if (bookedUser?.email && booking.serviceReportUrl) {
    try {
      await notify({
        userId: bookedUser._id,
        type: 'service_report',
        title: 'Service Inspection Report Ready',
        message: `Your service ${booking.bookingNumber} has been completed and the signed inspection certificate is ready.`,
        email: bookedUser.email,
        emailHtml: emailTemplates.serviceReportReady(booking.bookingNumber, booking.serviceType, booking.serviceReportUrl)
      });
    } catch (err) {
      logger.error({ err }, '[bookings] Service report notification failed');
    }
  }

  await writeAuditLog(req, 'complete_job', 'services', 'ServiceBooking', booking._id, null, {
    status: 'completed',
    serviceReportUrl: booking.serviceReportUrl
  });

  return ok(res, booking, 'Job completed and service certificate generated');
});
