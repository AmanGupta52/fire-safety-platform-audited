import { Types } from 'mongoose';
import { GalleryItem, GallerySourceType } from '../models/Content';

/**
 * Keeps the admin Gallery as a live mirror of every image attached to a product, category,
 * or blog post — however that image got there (a file uploaded straight from a PC, or a
 * hosted URL pasted in) — so Gallery shows everything in use across the site, not only
 * photos added on the Gallery page itself.
 *
 * Idempotent: matches on (image, sourceType, sourceId), so calling this again for the same
 * image on the same record updates its label instead of creating a duplicate card. Never
 * throws — mirroring is a convenience, and a failure here must never block the actual
 * product/category/post save.
 */
export async function mirrorGalleryImages(params: {
  images: (string | undefined | null)[];
  sourceType: Exclude<GallerySourceType, 'manual'>;
  sourceId: Types.ObjectId;
  sourceLabel: string;
}): Promise<void> {
  const { sourceType, sourceId, sourceLabel } = params;
  const uniqueImages = [...new Set(params.images.filter((url): url is string => Boolean(url)))];

  await Promise.all(
    uniqueImages.map((image) =>
      GalleryItem.findOneAndUpdate(
        { image, sourceType, sourceId },
        { title: sourceLabel, category: sourceType, image, sourceType, sourceId, sourceLabel },
        { upsert: true }
      ).catch((err) => console.error('[gallery-mirror] failed to mirror image:', err))
    )
  );
}

/** Removes mirrored Gallery entries for a record that no longer exists (hard-deleted). */
export async function removeMirroredGalleryImages(
  sourceType: Exclude<GallerySourceType, 'manual'>,
  sourceId: Types.ObjectId
): Promise<void> {
  await GalleryItem.deleteMany({ sourceType, sourceId }).catch((err) =>
    console.error('[gallery-mirror] failed to clean up mirrored images:', err)
  );
}
