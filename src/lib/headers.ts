export type Headers = Record<string, string>;

/**
 * @internal
 */
export const splitResponseHeaders = (baseHeaders: Headers) => {
  const headers: Headers = {};
  const s3Headers: Headers = {};
  for (const [key, value] of Object.entries(baseHeaders)) {
    const header = key.toLowerCase();
    if (header.startsWith('x-amz-') || header === 'server') {
      s3Headers[header] = value;
    } else {
      headers[header] = value;
    }
  }
  return { headers, s3Headers };
};

/**
 * @internal
 */
export const HEADER_TO_PARAM = {
  range: 'Range',
  'if-match': 'IfMatch',
  'if-none-match': 'IfNoneMatch',
  'if-modified-since': 'IfModifiedSince',
  'if-unmodified-since': 'IfUnmodifiedSince',
};

const DATE_PARAMS = new Set(['IfModifiedSince', 'IfUnmodifiedSince']);

/**
 * @internal
 */
export const valueToType = (param: string, value: any) => {
  if (DATE_PARAMS.has(param)) {
    return new Date(value);
  }
  return value;
};
