import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { IncomingMessage } from 'http';
import { s3Get, extractGetArgs } from '../src/lib/s3Get';

// Runs s3Get against Adobe S3Mock in a container. Requires Docker.

const S3MOCK_IMAGE = 'adobe/s3mock:5.0.0';
const S3MOCK_HTTP_PORT = 9090;
const BUCKET = 'test-bucket';

function streamToString(stream: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

describe('s3Get (integration, against Adobe S3Mock)', () => {
  let container: StartedTestContainer;
  let client: S3Client;

  beforeAll(async () => {
    container = await new GenericContainer(S3MOCK_IMAGE)
      .withExposedPorts(S3MOCK_HTTP_PORT)
      .withEnvironment({ COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS: BUCKET })
      .withWaitStrategy(Wait.forHttp('/', S3MOCK_HTTP_PORT).forStatusCode(200))
      .start();

    const endpoint = `http://${container.getHost()}:${container.getMappedPort(S3MOCK_HTTP_PORT)}`;
    client = new S3Client({
      endpoint,
      region: 'eu-central-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      // S3Mock returns the full-object checksum on partial (206) responses, which
      // the SDK would otherwise fail to validate against the ranged bytes.
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  });

  afterAll(async () => {
    client?.destroy();
    await container?.stop();
  });

  async function putObject(key: string, body: string, contentType = 'text/plain'): Promise<string> {
    const response = await client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    return response.ETag as string;
  }

  it('200: returns the body and splits generic vs aws-specific headers', async () => {
    const key = 'happy-path.txt';
    const content = 'hello from a real s3 server';
    await putObject(key, content, 'text/plain');

    const { body, headers, s3Headers, statusCode, error } = await s3Get(client, {
      Bucket: BUCKET,
      Key: key,
    });

    expect(statusCode).toBe(200);
    expect(error).toBeUndefined();
    expect(body).toBeInstanceOf(IncomingMessage);

    expect(headers['content-type']).toBe('text/plain');
    expect(headers['content-length']).toBe(String(Buffer.byteLength(content)));
    expect(headers['etag']).toBeDefined();
    expect(headers['last-modified']).toBeDefined();

    for (const name of Object.keys(headers)) {
      expect(name.startsWith('x-amz-')).toBe(false);
      expect(name).not.toBe('server');
    }
    for (const name of Object.keys(s3Headers)) {
      expect(name.startsWith('x-amz-') || name === 'server').toBe(true);
    }

    expect(await streamToString(body)).toBe(content);
  });

  it('404: returns an error for a missing key', async () => {
    const { statusCode, error } = await s3Get(client, {
      Bucket: BUCKET,
      Key: 'does-not-exist.txt',
    });

    expect(statusCode).toBe(404);
    expect(error).toBeDefined();
  });

  it('404: returns an error for a missing bucket', async () => {
    const { statusCode, error } = await s3Get(client, {
      Bucket: 'no-such-bucket-xyz',
      Key: 'whatever.txt',
    });

    expect(statusCode).toBe(404);
    expect(error).toBeDefined();
  });

  it('304: IfNoneMatch matching the current ETag yields Not Modified', async () => {
    const key = 'conditional-if-none-match.txt';
    const etag = await putObject(key, 'conditional content');

    const { statusCode, error } = await s3Get(client, {
      Bucket: BUCKET,
      Key: key,
      IfNoneMatch: etag,
    });

    expect(statusCode).toBe(304);
    expect(error).toBeDefined();
  });

  it('304: IfModifiedSince in the future yields Not Modified', async () => {
    const key = 'conditional-if-modified-since.txt';
    await putObject(key, 'more conditional content');
    const future = new Date(Date.now() + 60 * 60 * 1000);

    const { statusCode, error } = await s3Get(client, {
      Bucket: BUCKET,
      Key: key,
      IfModifiedSince: future,
    });

    expect(statusCode).toBe(304);
    expect(error).toBeDefined();
  });

  it('412: IfMatch with a stale ETag yields Precondition Failed', async () => {
    const key = 'precondition.txt';
    await putObject(key, 'precondition content');

    const { statusCode, error } = await s3Get(client, {
      Bucket: BUCKET,
      Key: key,
      IfMatch: '"00000000000000000000000000000000"',
    });

    expect(statusCode).toBe(412);
    expect(error).toBeDefined();
  });

  it('206: a Range request yields Partial Content', async () => {
    const key = 'range.txt';
    await putObject(key, '0123456789');

    const { body, headers, statusCode, error } = await s3Get(client, {
      Bucket: BUCKET,
      Key: key,
      Range: 'bytes=0-4',
    });

    expect(statusCode).toBe(206);
    expect(error).toBeUndefined();
    expect(headers['content-range']).toBeDefined();
    expect(await streamToString(body)).toBe('01234');
  });

  it('end-to-end: extractGetArgs forwards raw request headers into s3Get', async () => {
    const key = 'extract-args.txt';
    const etag = await putObject(key, 'end to end content');

    const incomingRequestHeaders = { 'if-none-match': etag };

    const { statusCode } = await s3Get(client, {
      Bucket: BUCKET,
      Key: key,
      ...extractGetArgs(incomingRequestHeaders),
    });

    expect(statusCode).toBe(304);
  });
});
