import { get, put, head, BlobPreconditionFailedError } from '@vercel/blob';
import { blankState, validateState } from './model.js';

const PATH = 'tagihanbulanan/state-v2.json';

export class MissingStorageError extends Error {
  constructor() { super('Penyimpanan server belum terhubung. Hubungkan Vercel Blob Private dan BLOB_READ_WRITE_TOKEN di Vercel.'); }
}

function ensureToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new MissingStorageError();
}

async function read() {
  const result = await get(PATH, { access: 'private' });
  if (!result) return null;
  const raw = await new Response(result.stream).text();
  return { state: JSON.parse(raw), etag: result.blob.etag };
}

// New installations start clean. Never reach into previous repository commits.
// Import historical bills explicitly through the CSV importer after login.
export async function loadState() {
  ensureToken();
  const saved = await read();
  if (saved) { validateState(saved.state); return saved; }
  const state = blankState();
  validateState(state);
  try {
    await put(PATH, JSON.stringify(state), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json'
    });
  } catch (error) {
    // A concurrent initial request may have created the file already.
    const concurrent = await read();
    if (concurrent) { validateState(concurrent.state); return concurrent; }
    throw error;
  }
  const initialized = await read();
  if (!initialized) throw new Error('Inisialisasi penyimpanan gagal');
  validateState(initialized.state);
  return initialized;
}

export async function saveState(state, etag) {
  ensureToken();
  validateState(state);
  const current = await read();
  if (!current) throw new Error('Penyimpanan belum diinisialisasi');
  if (current.etag !== etag) {
    const error = new Error('Data telah berubah di server. Muat ulang sebelum menyimpan.');
    error.status = 409;
    throw error;
  }
  state.revision = (current.state.revision || 0) + 1;
  state.updatedAt = new Date().toISOString();
  try {
    const result = await put(PATH, JSON.stringify(state), {
      access: 'private', contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true,
      ifMatch: etag, cacheControlMaxAge: 60
    });
    return {
      etag: result.etag ?? (await head(PATH)).etag,
      revision: state.revision, updatedAt: state.updatedAt
    };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      const conflict = new Error('Data berubah dari tab/perangkat lain. Simpan dibatalkan supaya tidak tertimpa.');
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
}
