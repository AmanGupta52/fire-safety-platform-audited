import { Router, Request, Response } from 'express';
import { Address } from '../models/Address';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const addresses = await Address.find({ user: req.user!.id }).sort({ isDefault: -1, createdAt: -1 });
  return ok(res, addresses);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (req.body.isDefault) {
    await Address.updateMany({ user: req.user!.id }, { isDefault: false });
  }
  const address = await Address.create({ ...req.body, user: req.user!.id });
  return created(res, address);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.body.isDefault) {
    await Address.updateMany({ user: req.user!.id }, { isDefault: false });
  }
  const address = await Address.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, req.body, { new: true });
  if (!address) throw ApiError.notFound('Address not found');
  return ok(res, address, 'Address updated');
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user!.id });
  if (!address) throw ApiError.notFound('Address not found');
  return ok(res, {}, 'Address deleted');
}));

export default router;
