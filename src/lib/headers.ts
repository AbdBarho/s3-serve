import type { HeaderBag } from '@aws-sdk/types';

export type Headers = Record<string, string>;

export function splitResponseHeaders(baseHeaders: HeaderBag) {
  const headers: Headers = {};
  const s3Headers: Headers = {};
  for (const [key, value] of Object.entries(baseHeaders)) {
    const header = key.toLowerCase();
    const target = header.startsWith('x-amz-') || header === 'server' ? s3Headers : headers;
    target[header] = value;
  }
  return { headers, s3Headers };
}

export const HEADER_TO_PARAM: Record<string, string> = {
  range: 'Range',
  'if-match': 'IfMatch',
  'if-none-match': 'IfNoneMatch',
  'if-modified-since': 'IfModifiedSince',
  'if-unmodified-since': 'IfUnmodifiedSince',
};

const DATE_PARAMS = new Set(['IfModifiedSince', 'IfUnmodifiedSince']);

export function valueToType(param: string, value: any) {
  if (DATE_PARAMS.has(param)) {
    return new Date(value);
  }
  return value;
}
