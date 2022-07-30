import { splitResponseHeaders } from '../src/lib/headers';
import { extractGetArgs } from '../src/lib/getS3';

const standardHeaders = {
  'content-type': 'A',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const awsSpecificHeaders = {
  'x-amz-test': 'value',
  'X-Amz-SHA': 'value',
  server: 'AmazonS3',
};

const argumentHeaders = {
  'if-none-match': 'value',
  'if-modified-since': '2022-01-01T00:00:00.130Z',
  'if-unmodified-since': '2022-01-01T00:00:00.130Z',
};

const lowerCase = (obj: any) =>
  Object.keys(obj).reduce((prev, curr) => {
    prev[curr.toLowerCase()] = obj[curr];
    return prev;
  }, {} as any);

describe('Headers', () => {
  describe('Split Response Headers', () => {
    it('Empty', () => {
      const { headers, s3Headers } = splitResponseHeaders({});
      expect(headers).toEqual({});
      expect(s3Headers).toEqual({});
    });

    it('Only standard headers', () => {
      const { headers, s3Headers } = splitResponseHeaders(standardHeaders);
      expect(headers).toEqual(lowerCase(standardHeaders));
      expect(s3Headers).toEqual({});
    });

    it('Only AWS headers', () => {
      const { headers, s3Headers } = splitResponseHeaders(awsSpecificHeaders);

      expect(s3Headers).toEqual(lowerCase(awsSpecificHeaders));
      expect(headers).toEqual({});
    });

    it('Both headers', () => {
      const { headers, s3Headers } = splitResponseHeaders(Object.assign({}, awsSpecificHeaders, standardHeaders));

      expect(s3Headers).toEqual(lowerCase(awsSpecificHeaders));
      expect(headers).toEqual(lowerCase(standardHeaders));
    });
  });

  describe('Extract Arguments', () => {
    it('Empty', () => {
      const args = extractGetArgs({});
      expect(args).toEqual({});
    });
    it('Non-arguments', () => {
      const args = extractGetArgs(standardHeaders);
      expect(args).toEqual({});
    });
    it('Only Arguments', () => {
      const args = extractGetArgs(argumentHeaders);
      expect(args).toEqual({
        IfNoneMatch: 'value',
        IfModifiedSince: new Date('2022-01-01T00:00:00.130Z'),
        IfUnmodifiedSince: new Date('2022-01-01T00:00:00.130Z'),
      });
    });

    it('Mixed', () => {
      const args = extractGetArgs(Object.assign({}, argumentHeaders, standardHeaders, awsSpecificHeaders));

      expect(args).toEqual({
        IfNoneMatch: 'value',
        IfModifiedSince: new Date('2022-01-01T00:00:00.130Z'),
        IfUnmodifiedSince: new Date('2022-01-01T00:00:00.130Z'),
      });
    });
  });
});
