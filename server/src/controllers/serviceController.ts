import { Request, Response } from 'express';
import slugify from 'slugify';
import { Types } from 'mongoose';
import { Service, IService } from '../models/Service';
import { ServiceBooking } from '../models/ServiceBooking';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created, paginationMeta } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';

function generateSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, trim: true });
}

// Normalize image object or string url
function normalizeImage(img: unknown) {
  if (!img) return undefined;
  if (typeof img === 'string') return { url: img };
  if (typeof img === 'object' && 'url' in (img as Record<string, unknown>)) {
    return img;
  }
  return undefined;
}

// ------------------- Public Endpoints -------------------

export const listPublicServices = asyncHandler(async (_req: Request, res: Response) => {
  const services = await Service.find({
    isDeleted: false,
    isActive: true,
    isPublished: true
  })
    .select('name slug shortDescription description startingPrice priceUnit currency category image gallery features inclusions exclusions estimatedDuration displayOrder isFeatured seoTitle seoDescription createdAt')
    .sort({ displayOrder: 1, createdAt: 1 });

  return ok(res, services, 'Services catalog fetched');
});

export const getPublicServiceBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const service = await Service.findOne({
    slug: slug.toLowerCase(),
    isDeleted: false,
    isActive: true,
    isPublished: true
  }).select('name slug shortDescription description startingPrice priceUnit currency category image gallery features inclusions exclusions estimatedDuration displayOrder isFeatured seoTitle seoDescription createdAt');

  if (!service) {
    throw ApiError.notFound(`Service not found: ${slug}`);
  }

  return ok(res, service, 'Service details fetched');
});

// ------------------- Admin Endpoints -------------------

export const adminListServices = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter: Record<string, unknown> = {};

  if (req.query.includeDeleted !== 'true') {
    filter.isDeleted = false;
  }

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === 'true';
  }

  if (req.query.isFeatured !== undefined) {
    filter.isFeatured = req.query.isFeatured === 'true';
  }

  if (req.query.category) {
    filter.category = String(req.query.category);
  }

  if (req.query.search) {
    const term = String(req.query.search).trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { slug: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
      { category: { $regex: term, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    Service.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Service.countDocuments(filter)
  ]);

  return ok(res, items, 'Admin services fetched', paginationMeta(page, limit, total));
});

export const adminGetServiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  let service: IService | null = null;

  if (Types.ObjectId.isValid(id)) {
    service = await Service.findById(id).populate('createdBy', 'name email').populate('updatedBy', 'name email');
  } else {
    service = await Service.findOne({ slug: id.toLowerCase() }).populate('createdBy', 'name email').populate('updatedBy', 'name email');
  }

  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  return ok(res, service);
});

export const adminCreateService = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    slug,
    shortDescription,
    description,
    startingPrice,
    priceUnit,
    currency,
    category,
    image,
    gallery,
    features,
    inclusions,
    exclusions,
    estimatedDuration,
    displayOrder,
    isActive,
    isPublished,
    isFeatured,
    seoTitle,
    seoDescription
  } = req.body;

  const targetSlug = slug ? generateSlug(slug) : generateSlug(name);

  const existing = await Service.findOne({ slug: targetSlug });
  if (existing) {
    throw ApiError.conflict(`A service with slug "${targetSlug}" already exists`);
  }

  const service = await Service.create({
    name: name.trim(),
    slug: targetSlug,
    shortDescription: shortDescription?.trim(),
    description: description.trim(),
    startingPrice,
    priceUnit: priceUnit?.trim() || '/unit',
    currency: currency?.trim() || 'INR',
    category: category?.trim() || 'general',
    image: normalizeImage(image),
    gallery: Array.isArray(gallery) ? gallery.map(normalizeImage).filter(Boolean) : [],
    features: Array.isArray(features) ? features : [],
    inclusions: Array.isArray(inclusions) ? inclusions : [],
    exclusions: Array.isArray(exclusions) ? exclusions : [],
    estimatedDuration: estimatedDuration?.trim(),
    displayOrder: displayOrder !== undefined ? displayOrder : 0,
    isActive: isActive !== undefined ? isActive : true,
    isPublished: isPublished !== undefined ? isPublished : true,
    isFeatured: isFeatured !== undefined ? isFeatured : false,
    isDeleted: false,
    seoTitle: seoTitle?.trim(),
    seoDescription: seoDescription?.trim(),
    createdBy: req.user ? new Types.ObjectId(req.user.id) : undefined,
    updatedBy: req.user ? new Types.ObjectId(req.user.id) : undefined
  });

  await writeAuditLog(req, 'create', 'services', 'Service', service._id, null, service.toObject());

  return created(res, service, 'Service created successfully');
});

export const adminUpdateService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const service = await Service.findById(id);
  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  const previous = service.toObject();

  if (req.body.slug && req.body.slug !== service.slug) {
    const newSlug = generateSlug(req.body.slug);
    const slugExists = await Service.findOne({ slug: newSlug, _id: { $ne: service._id } });
    if (slugExists) {
      throw ApiError.conflict(`A service with slug "${newSlug}" already exists`);
    }
    service.slug = newSlug;
  }

  const updatableKeys: (keyof IService)[] = [
    'name',
    'shortDescription',
    'description',
    'startingPrice',
    'priceUnit',
    'currency',
    'category',
    'features',
    'inclusions',
    'exclusions',
    'estimatedDuration',
    'displayOrder',
    'isActive',
    'isPublished',
    'isFeatured',
    'seoTitle',
    'seoDescription'
  ];

  for (const key of updatableKeys) {
    if (req.body[key] !== undefined) {
      (service as any)[key] = req.body[key];
    }
  }

  if (req.body.image !== undefined) {
    service.image = normalizeImage(req.body.image) as any;
  }

  if (Array.isArray(req.body.gallery)) {
    service.gallery = req.body.gallery.map(normalizeImage).filter(Boolean) as any;
  }

  if (req.user) {
    service.updatedBy = new Types.ObjectId(req.user.id);
  }

  await service.save();

  await writeAuditLog(req, 'update', 'services', 'Service', service._id, previous, service.toObject());

  return ok(res, service, 'Service updated successfully');
});

export const adminUpdateServiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const service = await Service.findById(id);
  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  const previous = service.toObject();

  if (req.body.isActive !== undefined) service.isActive = Boolean(req.body.isActive);
  if (req.body.isPublished !== undefined) service.isPublished = Boolean(req.body.isPublished);
  if (req.body.isFeatured !== undefined) service.isFeatured = Boolean(req.body.isFeatured);

  if (req.user) {
    service.updatedBy = new Types.ObjectId(req.user.id);
  }

  await service.save();

  await writeAuditLog(req, 'update_status', 'services', 'Service', service._id, previous, service.toObject());

  return ok(res, service, 'Service status updated successfully');
});

export const adminDeleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const service = await Service.findById(id);
  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  // Check if service is referenced by any bookings
  const bookingCount = await ServiceBooking.countDocuments({
    $or: [{ service: service._id }, { serviceType: service.slug }]
  });

  const previous = service.toObject();

  if (bookingCount > 0) {
    // Soft delete/deactivate so historical records remain valid
    service.isActive = false;
    service.isPublished = false;
    service.isDeleted = true;
    if (req.user) service.updatedBy = new Types.ObjectId(req.user.id);
    await service.save();

    await writeAuditLog(req, 'soft_delete', 'services', 'Service', service._id, previous, {
      isDeleted: true,
      reason: `Preserved due to ${bookingCount} existing bookings`
    });

    return ok(res, service, `Service has ${bookingCount} historical booking(s); it has been safely deactivated and archived.`);
  }

  if (req.query.permanent === 'true') {
    await Service.findByIdAndDelete(service._id);
    await writeAuditLog(req, 'delete', 'services', 'Service', service._id, previous, null);
    return ok(res, { id: service._id }, 'Service permanently deleted');
  }

  service.isActive = false;
  service.isPublished = false;
  service.isDeleted = true;
  if (req.user) service.updatedBy = new Types.ObjectId(req.user.id);
  await service.save();

  await writeAuditLog(req, 'soft_delete', 'services', 'Service', service._id, previous, { isDeleted: true });

  return ok(res, service, 'Service deactivated and moved to archive');
});

export const adminRestoreService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const service = await Service.findById(id);
  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  const previous = service.toObject();
  service.isDeleted = false;
  service.isActive = true;
  if (req.user) service.updatedBy = new Types.ObjectId(req.user.id);
  await service.save();

  await writeAuditLog(req, 'restore', 'services', 'Service', service._id, previous, service.toObject());

  return ok(res, service, 'Service restored successfully');
});

export const adminReorderServices = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; displayOrder: number }[] };

  const updates = items.map((item) =>
    Service.findByIdAndUpdate(item.id, { displayOrder: item.displayOrder }, { new: true })
  );

  await Promise.all(updates);

  await writeAuditLog(req, 'reorder', 'services', 'Service', 'bulk', null, { itemsCount: items.length });

  return ok(res, { count: items.length }, 'Services reordered successfully');
});
