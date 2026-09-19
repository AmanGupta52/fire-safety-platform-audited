import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { FAQ } from '../models/Content';
import { Setting } from '../models/AuditLog';

async function seed() {
  await connectDB();
  console.log('[seed] Connected. Seeding demo data (clearly marked, not real certifications/claims)...');

  // ---------- Admin account ----------
  const adminExists = await User.findOne({ email: env.seed.adminEmail });
  if (!adminExists) {
    await User.create({
      name: 'Super Admin',
      email: env.seed.adminEmail,
      password: env.seed.adminPassword,
      role: 'super_admin',
      isActive: true,
      isEmailVerified: true
    });
    console.log(`[seed] Admin created: ${env.seed.adminEmail} / (password from SEED_ADMIN_PASSWORD env var)`);
  } else {
    console.log('[seed] Admin already exists, skipping.');
  }

  // ---------- Demo staff ----------
  const demoStaff = [
    { name: 'Demo Sales Staff', email: 'sales@firesafety.example', role: 'sales' },
    { name: 'Demo Technician', email: 'technician@firesafety.example', role: 'technician' },
    { name: 'Demo Accountant', email: 'accountant@firesafety.example', role: 'accountant' }
  ];
  for (const staff of demoStaff) {
    const exists = await User.findOne({ email: staff.email });
    if (!exists) {
      await User.create({ ...staff, password: 'ChangeMe123!', isActive: true, isEmailVerified: true });
      console.log(`[seed] Staff created: ${staff.email} (${staff.role})`);
    }
  }

  // ---------- Categories ----------
  const categoryDefs = [
    { name: 'Fire Extinguishers', description: 'ABC, CO2, foam and water-based fire extinguishers' },
    { name: 'Gas Cylinders', description: 'Fire suppression gas cylinders and refills' },
    { name: 'Fire Hydrant Systems', description: 'Hydrant valves, hoses, landing valves and accessories' },
    { name: 'Fire Suppression Systems', description: 'Clean agent and sprinkler suppression systems' },
    { name: 'Smoke Detectors', description: 'Photoelectric and ionization smoke detectors' },
    { name: 'Fire Alarm Panels', description: 'Conventional and addressable fire alarm control panels' },
    { name: 'Fire Safety Accessories', description: 'Signage, mounting brackets, cabinets and PPE' },
    { name: 'AMC & Refilling', description: 'Annual maintenance and refilling service packages' }
  ];

  const categoryDocs: Record<string, mongoose.Types.ObjectId> = {};
  for (const def of categoryDefs) {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let category = await Category.findOne({ slug });
    if (!category) {
      category = await Category.create({ ...def, slug, isActive: true });
      console.log(`[seed] Category created: ${def.name}`);
    }
    categoryDocs[def.name] = category._id;
  }

  // ---------- Sample products (clearly demo data; no fake certifications) ----------
  const sampleProducts = [
    {
      name: 'ABC Dry Powder Fire Extinguisher 4kg', sku: 'FE-ABC-4KG', category: 'Fire Extinguishers',
      brand: 'Demo Brand', price: 1499, discountPrice: 1299, stock: 50, unit: 'pcs',
      capacity: '4kg', fireClass: ['A', 'B', 'C'], gstPercentage: 18,
      shortDescription: 'Multi-purpose dry powder extinguisher for Class A, B and C fires (demo product).',
      features: ['Wall-mount bracket included', 'IS-15683 style demo spec sheet'], isFeatured: true
    },
    {
      name: 'CO2 Fire Extinguisher 4.5kg', sku: 'FE-CO2-4-5KG', category: 'Fire Extinguishers',
      brand: 'Demo Brand', price: 2999, stock: 30, unit: 'pcs', capacity: '4.5kg', fireClass: ['B', 'C'],
      gstPercentage: 18, shortDescription: 'Carbon dioxide extinguisher suited for electrical fires (demo product).'
    },
    {
      name: 'Addressable Fire Alarm Panel - 4 Loop', sku: 'FAP-ADDR-4L', category: 'Fire Alarm Panels',
      brand: 'Demo Brand', price: 45999, stock: 8, unit: 'pcs', modelNumber: 'DB-FAP-4L',
      gstPercentage: 18, shortDescription: 'Four-loop addressable panel for mid-size commercial buildings (demo product).', isBestSeller: true
    },
    {
      name: 'Photoelectric Smoke Detector', sku: 'SD-PE-STD', category: 'Smoke Detectors',
      brand: 'Demo Brand', price: 899, stock: 100, unit: 'pcs', gstPercentage: 18,
      shortDescription: 'Ceiling-mount photoelectric smoke detector (demo product).'
    }
  ];

  for (const p of sampleProducts) {
    const exists = await Product.findOne({ sku: p.sku });
    if (!exists) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await Product.create({ ...p, slug, category: categoryDocs[p.category], isActive: true });
      console.log(`[seed] Product created: ${p.name}`);
    }
  }

  // ---------- FAQs ----------
  const faqDefs = [
    { question: 'How often should a fire extinguisher be refilled?', answer: 'Typically every 12 months, or per the manufacturer/regulatory guidance for your extinguisher type — configure your actual schedule in Admin > Settings.', category: 'General' },
    { question: 'Do you service AMC contracts for housing societies?', answer: 'Yes — AMC plans can be requested through the Services section and customized by our sales team.', category: 'AMC' },
    { question: 'Can I get a GST invoice for my order?', answer: 'Yes, a GST invoice is generated automatically once payment is confirmed and is available in My Account > Invoices.', category: 'Billing' }
  ];
  for (const f of faqDefs) {
    const exists = await FAQ.findOne({ question: f.question });
    if (!exists) await FAQ.create(f);
  }

  // ---------- Default settings ----------
  const companySetting = await Setting.findOne({ key: 'company' });
  if (!companySetting) {
    await Setting.create({
      key: 'company',
      value: {
        name: 'Your Fire Safety Company Pvt. Ltd. (DEMO — update in Admin > Settings)',
        address: 'Demo Address, Mumbai, Maharashtra, India',
        phone: '+91-00000-00000',
        email: 'info@firesafety.example',
        gstin: undefined,
        state: 'Maharashtra'
      }
    });
    console.log('[seed] Default company settings created (marked as demo — update before going live).');
  }

  console.log('[seed] Done.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
