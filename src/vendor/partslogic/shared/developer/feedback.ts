import type { Json } from '@partslogic/db-types';

import { call } from '../core/call';
import type { Client } from '../core/client';
import { DataError } from '../core/errors';
import { readArray, readNumber, readRecord, readString } from '../core/read';

// Staff feedback: anyone sends a thumbs up or down with a comment and a screenshot; owners and developers read it.
// The rules are in SQL (public.send_feedback, feedback_list, set_feedback_status); the screenshot goes to the private
// feedback bucket under the sender's own folder first, then its path is sent with the feedback.

export const FEEDBACK_BUCKET = 'feedback';
export const FEEDBACK_STATUSES = ['new', 'seen', 'done'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackRating = 'up' | 'down';
export const FEEDBACK_SCREENSHOT_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
export type FeedbackScreenshotType = keyof typeof FEEDBACK_SCREENSHOT_TYPES;
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
export const FEEDBACK_COMMENT_MAX = 2000;

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function isFeedbackScreenshotType(value: unknown): value is FeedbackScreenshotType {
  return typeof value === 'string' && value in FEEDBACK_SCREENSHOT_TYPES;
}

// Where a screenshot goes: the sender's own folder (the bucket's policy and send_feedback both check it).
export function feedbackScreenshotPath(userId: string, id: string, type: FeedbackScreenshotType): string {
  return `${userId}/${id}.${FEEDBACK_SCREENSHOT_TYPES[type]}`;
}

export type FeedbackInput = {
  rating: FeedbackRating;
  comment: string | null;
  pagePath: string;
  pageTitle: string | null;
  screenshotPath: string | null;
  viewport: string | null;
  userAgent: string | null;
  appVersion: string | null;
};

export type FeedbackItem = {
  id: string;
  rating: FeedbackRating;
  comment: string | null;
  pagePath: string;
  pageTitle: string | null;
  screenshotPath: string | null;
  viewport: string | null;
  userAgent: string | null;
  appVersion: string | null;
  status: FeedbackStatus;
  createdAt: string;
  by: string;
};

export type FeedbackList = {
  items: FeedbackItem[];
  counts: Record<FeedbackStatus | 'all', number>;
  // The last 30 days against the 30 before.
  figures: { up: number; down: number; upBefore: number; downBefore: number };
  // Pages with a thumbs down in the last 30 days, most first.
  pages: { page: string; title: string | null; up: number; down: number }[];
};

export type FeedbackQuery = { status?: FeedbackStatus | 'all'; rating?: FeedbackRating | null; limit?: number };

export function readFeedbackList(data: Json): FeedbackList {
  const record = readRecord(data) ?? {};
  const countsRecord = readRecord(record.counts) ?? {};
  const figures = readRecord(record.figures) ?? {};
  return {
    items: readArray(record.items).flatMap((item) => {
      const row = readRecord(item);
      const id = readString(row?.id);
      if (!row || !id) return [];
      return [
        {
          id,
          rating: row.rating === 'down' ? 'down' : 'up',
          comment: readString(row.comment),
          pagePath: readString(row.page_path) ?? '/',
          pageTitle: readString(row.page_title),
          screenshotPath: readString(row.screenshot_path),
          viewport: readString(row.viewport),
          userAgent: readString(row.user_agent),
          appVersion: readString(row.app_version),
          status: isFeedbackStatus(row.status) ? row.status : 'new',
          createdAt: readString(row.created_at) ?? '',
          by: readString(row.by) ?? 'Someone',
        },
      ];
    }),
    counts: {
      new: readNumber(countsRecord.new) ?? 0,
      seen: readNumber(countsRecord.seen) ?? 0,
      done: readNumber(countsRecord.done) ?? 0,
      all: readNumber(countsRecord.all) ?? 0,
    },
    figures: {
      up: readNumber(figures.up) ?? 0,
      down: readNumber(figures.down) ?? 0,
      upBefore: readNumber(figures.up_before) ?? 0,
      downBefore: readNumber(figures.down_before) ?? 0,
    },
    pages: readArray(record.pages).flatMap((item) => {
      const page = readRecord(item);
      const path = readString(page?.page);
      return path
        ? [{ page: path, title: readString(page?.title), up: readNumber(page?.up) ?? 0, down: readNumber(page?.down) ?? 0 }]
        : [];
    }),
  };
}

export async function sendFeedback(supabase: Client, input: FeedbackInput): Promise<string> {
  return call(
    supabase.rpc('send_feedback', {
      p: {
        rating: input.rating,
        comment: input.comment,
        page_path: input.pagePath,
        page_title: input.pageTitle,
        screenshot_path: input.screenshotPath,
        viewport: input.viewport,
        user_agent: input.userAgent,
        app_version: input.appVersion,
      },
    }),
    (data) => {
      const id = readString(data);
      if (!id) throw new DataError('The feedback was not saved.', 'P0001');
      return id;
    },
  );
}

export async function listFeedback(supabase: Client, query: FeedbackQuery = {}): Promise<FeedbackList> {
  return call(
    supabase.rpc('feedback_list', {
      p: { status: query.status ?? 'new', rating: query.rating ?? null, limit: query.limit ?? 100 },
    }),
    readFeedbackList,
  );
}

export async function setFeedbackStatus(supabase: Client, ids: string[], status: FeedbackStatus): Promise<number> {
  return call(supabase.rpc('set_feedback_status', { p_ids: ids, p_status: status }), (data) => readNumber(data) ?? 0);
}

// Uploads a screenshot to the sender's own folder and returns its path, to send with the feedback. The type and size
// are checked here and again by the bucket.
export async function uploadFeedbackScreenshot(
  supabase: Client,
  userId: string,
  file: Blob,
  contentType: string,
): Promise<string> {
  if (!isFeedbackScreenshotType(contentType)) throw new DataError('A screenshot is a PNG, JPEG or WebP image.', '22023');
  if (file.size > FEEDBACK_SCREENSHOT_MAX_BYTES) throw new DataError('A screenshot is up to 2 MB.', '22023');
  const path = feedbackScreenshotPath(userId, crypto.randomUUID(), contentType);
  const upload = await supabase.storage.from(FEEDBACK_BUCKET).upload(path, file, { contentType, upsert: false });
  if (upload.error) throw new DataError(upload.error.message, '42501');
  return path;
}

// Short-lived links to show screenshots (owners and developers may read the bucket), by path; a missing one is left out.
export async function feedbackScreenshotUrls(
  supabase: Client,
  paths: string[],
  seconds = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(FEEDBACK_BUCKET).createSignedUrls(paths, seconds);
  if (error || !data) return {};
  return Object.fromEntries(
    data.flatMap((entry) => (entry.path && entry.signedUrl && !entry.error ? [[entry.path, entry.signedUrl]] : [])),
  );
}
