import { Request, Response } from 'express';
import { ServiceBooking, ServiceStatus } from '../models/ServiceBooking';
import { Technician } from '../models/Technician';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created, paginationMeta } from '../utils/apiResponse';
import { nextNumber } from '../services/numberingService';
import { notify } from '../services/notificationService';
import { emailTemplates } from '../services/emailService';
import { writeAuditLog } from '../services/auditService';

export const createServiceBooking = asyncHandler(async (req: Request, res: Response) => {
  const { serviceType, phone, address, preferredDate, preferredTime, equipmentId, problemDescription, additionalNotes } = req.body;

  const bookingNumber = await nextNumber('service', 'SRV');
  const booking = await ServiceBooking.create({
    bookingNumber, user: req.user!.id, serviceType, phone, address,
    preferredDate: new Date(preferredDate), preferredTime,
    equipment: equipmentId || null, problemDescription, additionalNotes, status: 'requested'
  });

  const user = await User.findById(req.user!.id);
  await notify({
    userId: req.user!.id, type: 'service_booking', title: 'Service Booking Received',
    message: `Your ${serviceType.replace('_', ' ')} booking ${bookingNumber} has been received.`,
    email: user?.email, emailHtml: emailTemplates.serviceBooking(bookingNumber, serviceType), phone
  });

  return created(res, booking, 'Service booking submitted');
});

export const myServiceBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await ServiceBooking.find({ user: req.user!.id }).sort({ createdAt: -1 });
  return ok(res, bookings);
});

// ---------- Admin ----------

export const adminListServiceBookings = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.serviceType) filter.serviceType = req.query.serviceType;
  if (req.query.from || req.query.to) {
    filter.preferredDate = {};
    if (req.query.from) (filter.preferredDate as any).$gte = new Date(String(req.query.from));
    if (req.query.to) (filter.preferredDate as any).$lte = new Date(String(req.query.to));
  }

  const [items, total] = await Promise.all([
    ServiceBooking.find(filter).populate('user', 'name email phone').populate('assignedTechnician', 'name phone')
      .sort({ preferredDate: 1 }).skip((page - 1) * limit).limit(limit),
    ServiceBooking.countDocuments(filter)
  ]);
  return ok(res, items, 'Bookings fetched', paginationMeta(page, limit, total));
});

export const adminAssignTechnician = asyncHandler(async (req: Request, res: Response) => {
  const { technicianId } = req.body;
  const technician = await Technician.findOne({ _id: technicianId, status: 'active' });
  if (!technician) throw ApiError.notFound('Active technician not found');

  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  booking.assignedTechnician = technician._id;
  booking.status = 'assigned';
  await booking.save();

  await writeAuditLog(req, 'assign_technician', 'services', 'ServiceBooking', booking._id, null, { technicianId });
  await notify({
    userId: booking.user, type: 'service_reminder', title: 'Technician Assigned',
    message: `A technician has been assigned to your booking ${booking.bookingNumber}.`
  });

  return ok(res, booking, 'Technician assigned');
});

export const adminUpdateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, adminNotes } = req.body as { status: ServiceStatus; adminNotes?: string };
  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  const previous = booking.toObject();

  booking.status = status;
  if (adminNotes) booking.adminNotes = adminNotes;
  await booking.save();

  await writeAuditLog(req, 'update_status', 'services', 'ServiceBooking', booking._id, previous, booking.toObject());
  return ok(res, booking, 'Booking status updated');
});

export const adminUploadServiceReport = asyncHandler(async (req: Request, res: Response) => {
  const { serviceReportUrl, beforePhotos, afterPhotos } = req.body;
  const booking = await ServiceBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  if (serviceReportUrl) booking.serviceReportUrl = serviceReportUrl;
  if (Array.isArray(beforePhotos)) booking.beforePhotos.push(...beforePhotos);
  if (Array.isArray(afterPhotos)) booking.afterPhotos.push(...afterPhotos);
  await booking.save();

  return ok(res, booking, 'Service report saved');
});

// Technician-facing views (their own assigned jobs)
export const technicianMyJobs = asyncHandler(async (req: Request, res: Response) => {
  const technician = await Technician.findOne({ user: req.user!.id });
  if (!technician) throw ApiError.notFound('Technician profile not found for this account');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [todaysJobs, upcomingJobs, completedJobs] = await Promise.all([
    ServiceBooking.find({ assignedTechnician: technician._id, preferredDate: { $gte: today, $lt: tomorrow } }),
    ServiceBooking.find({ assignedTechnician: technician._id, preferredDate: { $gte: tomorrow }, status: { $ne: 'completed' } }),
    ServiceBooking.find({ assignedTechnician: technician._id, status: 'completed' }).sort({ updatedAt: -1 }).limit(20)
  ]);

  return ok(res, { todaysJobs, upcomingJobs, completedJobs });
});
