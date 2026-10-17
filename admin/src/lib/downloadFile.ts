import axios from 'axios';
import { api, ApiErrorBody } from './apiClient';

/** Pulls the server's error message out of a failed download (the body arrives as a Blob, not as JSON). */
async function messageFromBlobError(err: unknown): Promise<string | null> {
  if (!axios.isAxiosError(err) || !(err.response?.data instanceof Blob)) return null;
  try {
    const body = JSON.parse(await err.response.data.text()) as ApiErrorBody;
    return body.message || null;
  } catch {
    return null;
  }
}

/**
 * Downloads a file from an API path that needs the signed-in user's token (so a plain <a href> can't be used), and
 * saves it under `fileName`. Network failures are re-thrown untouched so the app's usual "can't reach the server"
 * handling applies; any other failure becomes an Error with the server's own message.
 */
export async function downloadFile(path: string, fileName: string): Promise<void> {
  let blob: Blob;
  try {
    blob = (await api.get<Blob>(path, { responseType: 'blob' })).data;
  } catch (err) {
    const message = await messageFromBlobError(err);
    throw message ? new Error(message) : err;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName; // the saved file is named and typed correctly regardless of the response URL
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the save before releasing the temporary URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
