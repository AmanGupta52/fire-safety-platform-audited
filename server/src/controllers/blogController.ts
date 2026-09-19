import { Request, Response } from 'express';
import slugify from 'slugify';
import { BlogPost } from '../models/BlogPost';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created, paginationMeta } from '../utils/apiResponse';

export const listPublishedPosts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const filter: Record<string, unknown> = { isPublished: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) filter.title = { $regex: String(req.query.q), $options: 'i' };

  const [items, total] = await Promise.all([
    BlogPost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('-content'),
    BlogPost.countDocuments(filter)
  ]);
  return ok(res, items, 'Posts fetched', paginationMeta(page, limit, total));
});

export const getPostBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true });
  if (!post) throw ApiError.notFound('Article not found');

  const related = await BlogPost.find({
    category: post.category, _id: { $ne: post._id }, isPublished: true
  }).limit(3).select('-content');

  return ok(res, { post, related });
});

// ---------- Admin ----------

export const adminListPosts = asyncHandler(async (req: Request, res: Response) => {
  const posts = await BlogPost.find().sort({ createdAt: -1 });
  return ok(res, posts);
});

export const adminCreatePost = asyncHandler(async (req: Request, res: Response) => {
  const slug = slugify(req.body.title, { lower: true, strict: true });
  const exists = await BlogPost.findOne({ slug });
  if (exists) throw ApiError.conflict('A post with this title already exists');

  const post = await BlogPost.create({
    ...req.body, slug, author: req.user!.id,
    publishedAt: req.body.isPublished ? new Date() : undefined
  });
  return created(res, post);
});

export const adminUpdatePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw ApiError.notFound('Post not found');

  if (req.body.title && req.body.title !== post.title) {
    req.body.slug = slugify(req.body.title, { lower: true, strict: true });
  }
  if (req.body.isPublished && !post.isPublished) {
    req.body.publishedAt = new Date();
  }
  Object.assign(post, req.body);
  await post.save();
  return ok(res, post, 'Post updated');
});

export const adminDeletePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPost.findByIdAndDelete(req.params.id);
  if (!post) throw ApiError.notFound('Post not found');
  return ok(res, {}, 'Post deleted');
});
