import { Request, Response } from 'express';
import { Setting, ICompanySettings } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { ApiError } from '../utils/ApiError';
import { writeAuditLog } from '../services/auditService';

const PUBLIC_SETTING_KEYS = ['company', 'shipping', 'reminders'];

const SAFE_COMPANY_KEYS: (keyof ICompanySettings | string)[] = [
  'name',
  'companyName',
  'logo',
  'favicon',
  'description',
  'phone',
  'alternatePhone',
  'whatsapp',
  'whatsApp',
  'email',
  'address',
  'city',
  'state',
  'pincode',
  'googleMapsUrl',
  'businessHours',
  'emergencyContact',
  'gstin',
  'gstNumber',
  'licenseInformation',
  'socialLinks',
  'footerText',
  'copyrightText'
];

export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const setting = await Setting.findOne({ key: req.params.key });
  return ok(res, setting?.value || {});
});

/**
 * Public, read-only subset used by the storefront footer, contact page, checkout.
 * Returns only safe fields; never exposes secrets, credentials, or internal configuration.
 */
export const getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await Setting.find({ key: { $in: PUBLIC_SETTING_KEYS } });
  const result: Record<string, unknown> = {};

  for (const s of settings) {
    if (s.key === 'company' && typeof s.value === 'object' && s.value !== null) {
      const rawCompany = s.value as Record<string, unknown>;
      const safeCompany: Record<string, unknown> = {};
      for (const k of SAFE_COMPANY_KEYS) {
        if (rawCompany[k] !== undefined) {
          safeCompany[k] = rawCompany[k];
        }
      }
      // Ensure canonical naming fallbacks
      safeCompany.companyName = safeCompany.companyName || safeCompany.name || 'Shubam Fire Protection';
      safeCompany.name = safeCompany.name || safeCompany.companyName;
      result.company = safeCompany;
    } else {
      result[s.key] = s.value;
    }
  }

  // Fallback default company if not yet saved in DB
  if (!result.company) {
    result.company = {
      companyName: 'Shubam Fire Protection',
      name: 'Shubam Fire Protection',
      phone: '+91-00000-00000',
      email: 'info@firesafety.example',
      address: 'Mumbai, Maharashtra, India',
      businessHours: 'Mon - Sat: 9:00 AM - 6:00 PM'
    };
  }

  return ok(res, result);
});

export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  // Super Admin security restriction: Only Super Admin is authorized to modify settings
  if (!req.user || req.user.role !== 'super_admin') {
    throw ApiError.forbidden('Only Super Admin is authorized to modify system settings and company details');
  }

  let finalValue = req.body.value;

  // If updating company settings, ensure two-way synchronization between legacy & new canonical fields
  if (key === 'company' && typeof finalValue === 'object' && finalValue !== null) {
    finalValue = { ...finalValue };

    // Sync companyName <-> name
    if (finalValue.companyName && !finalValue.name) {
      finalValue.name = finalValue.companyName;
    } else if (finalValue.name && !finalValue.companyName) {
      finalValue.companyName = finalValue.name;
    }

    // Sync gstNumber <-> gstin
    if (finalValue.gstNumber && !finalValue.gstin) {
      finalValue.gstin = finalValue.gstNumber;
    } else if (finalValue.gstin && !finalValue.gstNumber) {
      finalValue.gstNumber = finalValue.gstin;
    }

    // Sync whatsapp
    if (finalValue.whatsapp && !finalValue.whatsApp) {
      finalValue.whatsApp = finalValue.whatsapp;
    } else if (finalValue.whatsApp && !finalValue.whatsapp) {
      finalValue.whatsapp = finalValue.whatsApp;
    }
  }

  const previous = await Setting.findOne({ key });
  const updated = await Setting.findOneAndUpdate(
    { key },
    { value: finalValue },
    { upsert: true, new: true }
  );

  await writeAuditLog(req, 'update', 'settings', 'Setting', key, previous?.value, finalValue);
  return ok(res, updated, 'Setting updated');
});

export const listAllSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await Setting.find();
  return ok(res, settings);
});
