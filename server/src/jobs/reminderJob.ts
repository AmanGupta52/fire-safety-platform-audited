import { CustomerEquipment } from '../models/CustomerEquipment';
import { AMCContract } from '../models/AMCContract';
import { NotificationLog } from '../models/Notification';
import { notify } from '../services/notificationService';
import { emailTemplates } from '../services/emailService';

// Milestones checked for every due date, matching the spec exactly.
const MILESTONES: { label: string; daysBefore: number }[] = [
  { label: '30_days_before', daysBefore: 30 },
  { label: '15_days_before', daysBefore: 15 },
  { label: '7_days_before', daysBefore: 7 },
  { label: '1_day_before', daysBefore: 1 },
  { label: 'due_today', daysBefore: 0 }
];

function daysUntil(date: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

/**
 * Prevents duplicate notifications: one row per (entity, milestone, channel) in NotificationLog.
 * If a document already exists for today's milestone, we skip sending again.
 */
async function alreadySent(entityType: 'equipment' | 'amc', entityId: string, milestone: string, channel: string) {
  const existing = await NotificationLog.findOne({ entityType, entityId, milestone, channel });
  return Boolean(existing);
}

async function logSent(entityType: 'equipment' | 'amc', entityId: string, milestone: string, channel: 'in_app' | 'email' | 'sms' | 'whatsapp', success: boolean) {
  await NotificationLog.create({ entityType, entityId, milestone, channel, success }).catch(() => undefined);
  // Unique index on (entityType, entityId, milestone, channel) means a duplicate insert throws —
  // caught and ignored above so a second cron tick in the same day never double-sends.
}

function resolveMilestone(daysLeft: number): string | null {
  if (daysLeft < 0) return 'overdue';
  const match = MILESTONES.find((m) => m.daysBefore === daysLeft);
  return match ? match.label : null;
}

export async function runEquipmentReminderScan(): Promise<{ checked: number; sent: number }> {
  const equipment = await CustomerEquipment.find({
    $or: [{ nextInspectionDate: { $exists: true } }, { nextRefillDate: { $exists: true } }]
  }).populate('user', 'name email phone');

  let sent = 0;

  for (const item of equipment) {
    const user = item.user as any;
    if (!user) continue;

    for (const [dateField, kind] of [
      ['nextRefillDate', 'refill_reminder'],
      ['nextInspectionDate', 'inspection_reminder']
    ] as const) {
      const dueDate: Date | undefined = (item as any)[dateField];
      if (!dueDate) continue;

      const milestone = resolveMilestone(daysUntil(dueDate));
      if (!milestone) continue;

      const already = await alreadySent('equipment', item._id.toString(), `${kind}:${milestone}`, 'email');
      if (already) continue;

      const emailHtml = kind === 'refill_reminder'
        ? emailTemplates.refillReminder(item.productNameSnapshot, dueDate.toLocaleDateString('en-IN'))
        : emailTemplates.inspectionReminder(item.productNameSnapshot, dueDate.toLocaleDateString('en-IN'));

      await notify({
        userId: user._id, type: kind, title: kind === 'refill_reminder' ? 'Refill Due' : 'Inspection Due',
        message: `${item.productNameSnapshot} (Serial: ${item.serialNumber}) ${kind === 'refill_reminder' ? 'refill' : 'inspection'} is ${milestone === 'overdue' ? 'overdue' : `due on ${dueDate.toLocaleDateString('en-IN')}`}.`,
        email: user.email, emailHtml, phone: user.phone,
        relatedEntity: 'CustomerEquipment', relatedEntityId: item._id
      });

      await logSent('equipment', item._id.toString(), `${kind}:${milestone}`, 'email', true);
      sent += 1;
    }
  }

  return { checked: equipment.length, sent };
}

export async function runAmcExpiryScan(): Promise<{ checked: number; sent: number }> {
  const contracts = await AMCContract.find({ status: { $in: ['active', 'expiring_soon'] } }).populate('user', 'name email phone');
  let sent = 0;

  for (const contract of contracts) {
    const user = contract.user as any;
    if (!user) continue;

    const milestone = resolveMilestone(daysUntil(contract.endDate));
    if (!milestone) continue;

    const already = await alreadySent('amc', contract._id.toString(), `amc_reminder:${milestone}`, 'email');
    if (already) continue;

    await notify({
      userId: user._id, type: 'amc_reminder', title: 'AMC Renewal Reminder',
      message: `Your AMC plan "${contract.planName}" ${milestone === 'overdue' ? 'has expired' : `expires on ${contract.endDate.toLocaleDateString('en-IN')}`}.`,
      email: user.email, emailHtml: emailTemplates.amcReminder(contract.planName, contract.endDate.toLocaleDateString('en-IN')),
      phone: user.phone, relatedEntity: 'AMCContract', relatedEntityId: contract._id
    });

    await logSent('amc', contract._id.toString(), `amc_reminder:${milestone}`, 'email', true);
    sent += 1;

    if (milestone === 'overdue' && contract.status !== 'expired') {
      contract.status = 'expired';
      await contract.save();
    } else if (['30_days_before', '15_days_before', '7_days_before'].includes(milestone) && contract.status === 'active') {
      contract.status = 'expiring_soon';
      await contract.save();
    }
  }

  return { checked: contracts.length, sent };
}

export async function runLowStockScan(): Promise<{ lowStockCount: number }> {
  const { Product } = await import('../models/Product');
  const lowStock = await Product.find({ isActive: true, stock: { $lte: 5 } });

  for (const product of lowStock) {
    const already = await alreadySent('equipment', `low_stock:${product._id}`, new Date().toISOString().slice(0, 10), 'in_app');
    if (already) continue;
    await notify({
      type: 'low_stock', title: 'Low Stock Alert',
      message: `${product.name} (SKU: ${product.sku}) has only ${product.stock} unit(s) left.`
    });
    await logSent('equipment', `low_stock:${product._id}`, new Date().toISOString().slice(0, 10), 'in_app', true);
  }

  return { lowStockCount: lowStock.length };
}
