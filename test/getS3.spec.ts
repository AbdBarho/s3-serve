import nock from 'nock';
import { S3Client } from '@aws-sdk/client-s3';
import { getS3 } from '../src/lib/getS3';
import { IncomingMessage } from 'http';

describe('ServeS3', () => {
  afterAll(() => nock.enableNetConnect());

  const client = new S3Client({
    region: 'eu-central-1',
    credentials: {
      accessKeyId: 'testt',
      secretAccessKey: 'test',
    },
  });

  it('Can Succeed', async () => {
    nock.disableNetConnect();

    const date = new Date();
    nock(/bucket\.s3\.eu-central-1\.amazonaws\.com/)
      .get('/file.txt')
      .query({ 'x-id': 'GetObject' })
      .reply(200, 'test string', {
        Date: date.toString(),
      });

    const { headers, body, s3Headers, statusCode, error } = await getS3(client, {
      Bucket: 'bucket',
      Key: 'file.txt',
    });
    expect(headers).toEqual({ date: date.toString() });
    expect(s3Headers).toEqual({});
    expect(statusCode).toBe(200);
    expect(body instanceof IncomingMessage).toBe(true);
    expect(error).toBeUndefined();
  });
});
