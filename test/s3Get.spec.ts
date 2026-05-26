import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { s3Get } from '../src/lib/s3Get';

// Exercises s3Get against a local HTTP server that mimics S3, using a default
// S3Client. With the default `responseChecksumValidation`, the SDK wraps the
// GetObject body in a ChecksumStream whenever the response carries a checksum
// header, so the body is no longer the raw IncomingMessage. No Docker required.

const CONTENT = 'hello from a fake s3 server';

// Minimal CRC32 so the response checksum header validates while streaming.
function crc32Base64(buf: Buffer): string {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  crc = (crc ^ 0xffffffff) >>> 0;
  const out = Buffer.alloc(4);
  out.writeUInt32BE(crc);
  return out.toString('base64');
}

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

describe('s3Get (against a local fake S3, default client config)', () => {
  let server: Server;
  let client: S3Client;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if ((req.url ?? '').includes('missing')) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><RequestId>REQ404</RequestId></Error>`;
        res.writeHead(404, {
          'content-type': 'application/xml',
          'content-length': Buffer.byteLength(xml),
          server: 'AmazonS3',
          'x-amz-request-id': 'REQ404',
        });
        res.end(xml);
        return;
      }
      const buf = Buffer.from(CONTENT);
      res.writeHead(200, {
        'content-type': 'text/plain',
        'content-length': buf.length,
        etag: '"abc123"',
        'last-modified': new Date(0).toUTCString(),
        server: 'AmazonS3',
        'x-amz-request-id': 'REQ200',
        // Presence of a checksum header makes the default client wrap the body.
        'x-amz-checksum-crc32': crc32Base64(buf),
      });
      res.end(buf);
    });
    await new Promise<void>(resolve => server.listen(0, resolve));

    const { port } = server.address() as AddressInfo;
    client = new S3Client({
      endpoint: `http://localhost:${port}`,
      region: 'eu-central-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
  });

  afterAll(async () => {
    client?.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('200: returns status, splits headers, and streams the body even when the body is checksum-wrapped', async () => {
    const { body, headers, s3Headers, statusCode, statusMessage, error } = await s3Get(client, {
      Bucket: 'b',
      Key: 'found.txt',
    });

    expect(statusCode).toBe(200);
    expect(statusMessage).toBe('OK');
    expect(error).toBeUndefined();

    expect(headers['content-type']).toBe('text/plain');
    expect(headers['content-length']).toBe(String(Buffer.byteLength(CONTENT)));
    expect(headers['etag']).toBe('"abc123"');
    expect(headers['last-modified']).toBeDefined();

    expect(s3Headers['server']).toBe('AmazonS3');
    expect(s3Headers['x-amz-request-id']).toBe('REQ200');
    for (const name of Object.keys(headers)) {
      expect(name.startsWith('x-amz-')).toBe(false);
      expect(name).not.toBe('server');
    }

    expect(await streamToString(body)).toBe(CONTENT);
  });

  it('404: returns the status and error for a missing key', async () => {
    const { statusCode, error } = await s3Get(client, { Bucket: 'b', Key: 'missing.txt' });

    expect(statusCode).toBe(404);
    expect(error).toBeDefined();
  });
});
