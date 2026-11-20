import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { readArray, readBoolean, readNumber, readRecord, readString } from '../core/read';

// Photos on a request (docs/SALES.md, section 13.6): the customer's own pictures of the old part or its label. The
// file goes to the private enquiry-photos bucket first; the database then puts it on the request.

export const ENQUIRY_PHOTO_BUCKET = 'enquiry-photos';
export const ENQUIRY_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const ENQUIRY_PHOTO_MAX_PER_REQUEST = 12;
const PHOTO_EXTENSIONS: Record<string, 'jpg' | 'png'> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

export type RequestPhoto = {
  id: number;
  name: string;
  // Where the file is in the bucket.
  path: string;
  // It came with the enquiry, as against being added later.
  atCapture: boolean;
  addedAt: string;
  addedBy: string | null;
};

export function readRequestPhotos(value: Json | undefined): RequestPhoto[] {
  return readArray(value).flatMap((item) => {
    const row = readRecord(item);
    const id = readNumber(row?.id);
    const path = readString(row?.path);
    if (!row || id == null || !path) return [];
    return [
      {
        id,
        name: readString(row.name) ?? 'Photo',
        path,
        atCapture: readBoolean(row.at_capture) ?? false,
        addedAt: readString(row.added_at) ?? '',
        addedBy: readString(row.added_by),
      },
    ];
  });
}

// Why a file cannot be a photo, in words for the person, or null when it can.
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!(file.type in PHOTO_EXTENSIONS)) return 'A photo is a JPEG or PNG image.';
  if (file.size > ENQUIRY_PHOTO_MAX_BYTES) return 'A photo is up to 10 MB. Send a smaller one.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

// Where a new photo's file goes: under its enquiry, named by a fresh id. Null for a type that is not a photo.
export function enquiryPhotoPath(enquiryId: string, fileId: string, type: string): string | null {
  const extension = PHOTO_EXTENSIONS[type];
  return extension ? `${enquiryId}/${fileId}.${extension}` : null;
}

// The name shown under a photo: the file's own name without its ending, or "Photo 3" for one that was pasted.
export function photoName(fileName: string | null | undefined, position: number): string {
  const base = (fileName ?? '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // A pasted picture arrives as "image.png": that says nothing.
  return base && !/^image$/i.test(base) ? base.slice(0, 120) : `Photo ${position}`;
}

// Where a photo came from: "Sent with the enquiry · Customer · WhatsApp", or "Added Fri 14:10 by Alex Morgan".
export function photoSourceWords(photo: Pick<RequestPhoto, 'atCapture' | 'addedAt' | 'addedBy'>, channel: string, when: (at: string) => string): string {
  if (photo.atCapture) return `Sent with the enquiry · Customer · ${channel}`;
  return `Added ${when(photo.addedAt)}${photo.addedBy ? ` by ${photo.addedBy}` : ''}`;
}

export function addEnquiryPhoto(supabase: Client, requestId: number, photo: { path: string; name: string; atCapture?: boolean }): Promise<number> {
  const p: { [key: string]: Json } = { path: photo.path, name: photo.name };
  if (photo.atCapture) p.at_capture = true;
  return call(supabase.rpc('enquiry_add_photo', { p_request: requestId, p }), (data) => readNumber(data) ?? 0);
}

// Takes the photo off its request and gives back where its file is, for the caller to remove.
export function removeEnquiryPhoto(supabase: Client, photoId: number): Promise<string | null> {
  return call(supabase.rpc('enquiry_remove_photo', { p_photo: photoId }), (data) => readString(data));
}
