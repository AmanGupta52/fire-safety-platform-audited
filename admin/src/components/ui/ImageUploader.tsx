import { useRef, useState } from 'react';
import { UploadCloud, X, Link2, Loader2, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { api, apiErrorMessage } from '../../lib/apiClient';

interface UploadResult { url: string; publicId?: string }

async function uploadFile(file: File, folder: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/uploads/image/${folder}`, formData);
  return res.data.data as UploadResult;
}

/**
 * Single-image uploader: drag/drop or click to upload straight to Cloudinary (via our
 * backend), or paste an already-hosted image URL instead. Used for category images and
 * blog cover images.
 */
export function SingleImageUploader({ value, onChange, folder }: { value?: string; onChange: (url: string) => void; folder: string }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file, folder);
      onChange(result.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative w-40">
          <img src={value} alt="" className="h-28 w-40 rounded border border-line object-cover" />
          <button type="button" onClick={() => onChange('')} className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white shadow" aria-label="Remove image">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-40 flex-col items-center justify-center gap-1.5 rounded border border-dashed border-line bg-paper text-slateink hover:bg-white disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
          <span className="text-xs">{uploading ? 'Uploading...' : 'Click to upload'}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-slateink" />
        <input
          type="text" placeholder="...or paste an image URL"
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onBlur={() => { if (urlInput.trim()) { onChange(urlInput.trim()); setUrlInput(''); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (urlInput.trim()) { onChange(urlInput.trim()); setUrlInput(''); } } }}
          className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-xs text-ink focus:border-ink focus:outline-none"
        />
      </div>
    </div>
  );
}

/**
 * Multi-image uploader for products: upload several files (uploaded one-by-one to
 * Cloudinary) or add hosted URLs, reorder isn't supported but removal and a running
 * thumbnail strip are.
 */
export function MultiImageUploader({ value, onChange, folder }: { value: UploadResult[]; onChange: (images: UploadResult[]) => void; folder: string }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadFile(f, folder)));
      onChange([...value, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length !== 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function addUrl() {
    if (!urlInput.trim()) return;
    onChange([...value, { url: urlInput.trim() }]);
    setUrlInput('');
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {value.map((img, i) => (
          <div key={i} className="relative h-20 w-20">
            <img src={img.url} alt="" className="h-20 w-20 rounded border border-line object-cover" />
            <button type="button" onClick={() => remove(i)} className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white shadow" aria-label="Remove image">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={clsx(
            'flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-line bg-paper text-slateink hover:bg-white disabled:opacity-60'
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="text-[10px]">{uploading ? 'Uploading' : 'Add photos'}</span>
        </button>
      </div>
      <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-slateink" />
        <input
          type="text" placeholder="...or paste an image URL and press Enter"
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
          className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-xs text-ink focus:border-ink focus:outline-none"
        />
      </div>
    </div>
  );
}
