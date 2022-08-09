import type { ResponseMetadata } from '@aws-sdk/types';
import type { IncomingMessage } from 'http';
import type { Headers } from './headers';

export interface S3Response {
  /**
   * The body of the S3 response, this is the raw
   * [IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage)
   * received by the `S3Client`. It inherits from
   * [stream.Readable](https://nodejs.org/api/stream.html#class-streamreadable)
   * and can be piped directly to an output stream.
   *
   * With express, you can pipe the body to the `Response` object
   *
   * ```js
   * app.get('/some-path', async (req, res) => {
   *   const { body } = await s3Get(client, { Bucket, Key });
   *   body.pipe(res);
   * })
   * ```
   *
   * Fastify on the other hand
   * [accepts streams natively](https://www.fastify.io/docs/latest/Reference/Reply/#streams):
   *
   * ```js
   * fastify.get('/some-path', async (req, res) => {
   *   const { body } = await s3Get(client, { Bucket, Key });
   *   return body;
   * });
   * ```
   *
   * In NestJS, you would need to use a
   * [StreamableFile](https://docs.nestjs.com/techniques/streaming-files):
   *
   * ```js
   * \@Get('/some-path')
   * getFile() {
   *   const { body } = await s3Get(client, { Bucket, Key });
   *   return new StreamableFile(body);
   * }
   * ```
   *
   * Note: in case of non-2xx `statusCode`, the `S3Client` will consume the contents
   * of the stream (to parse the XML error response), in this case the body will be empty.
   */
  body: IncomingMessage;
  /**
   * An object containing generic response headers received from S3,
   * like `content-type`, `content-length`, etc..
   *
   * All headers are always lowercase.
   *
   * In Express, you can use `Response.set` to set the headers of the response
   *
   * ```js
   * app.get('/some-path', async (req, res) => {
   *   const { body, headers } = await s3Get(client, { Bucket, Key });
   *   res.set(headers);
   *   body.pipe(res);
   * })
   * ```
   *
   * Fastify uses `Response.headers`:
   *
   * ```js
   * fastify.get('/some-path', async (req, res) => {
   *   const { body, headers } = await s3Get(client, { Bucket, Key });
   *   res.headers(headers);
   *   return body;
   * });
   * ```
   *
   * There is no clean way of setting headers in NestJS, [you have to fallback to the underlying framework native response object, and handle it manually like above.](https://docs.nestjs.com/controllers#request-object)
   */
  headers: Headers;
  /**
   * The 3-digit HTTP response status code. e.g. `404`.
   *
   * The value comes directly from the [IncomingMessage](https://nodejs.org/api/http.html#messagestatuscode) of the {@link body}
   */
  statusCode: number;
  /**
   * A string indicating the status of the response (`'OK'`, `'Access Denied'`, etc...).
   * Useful for informing the requester of errors without exposing the internals.
   *
   * The value comes directly from the [IncomingMessage](https://nodejs.org/api/http.html#messagestatusmessage) of the {@link body}
   *
   * Fastify example:
   * ```js
   * fastify.get('/some-path', async (req, res) => {
   *   const { body, headers, statusCode, statusMessage, error } = await s3Get(client, { Bucket, Key });
   *   if (error){
   *      console.error(error);
   *      res.status(statusCode);
   *      return statusMessage;
   *   }
   *   res.status(statusCode).headers(headers);
   *   return body;
   * });
   * ```
   */
  statusMessage: string;
  /**
   * An object containing aws-specific response headers received from S3, that may not be relevant for the requester of the object, but could be useful for debugging.
   *
   * These headers include the `server: AmazonS3`, as well as all other headers that begin with `x-amz-`.
   *
   * You can send these headers in the response if you want to.
   *
   * Fastify example:
   * ```js
   * fastify.get('/some-path', async (req, res) => {
   *   const { body, headers, s3Headers } = await s3Get(client, { Bucket, Key });
   *   res.headers({ ...s3Headers, ...headers });
   *   return body;
   * });
   * ```
   */
  s3Headers: Headers;
  /**
   * the `$metadata` object in the [S3Client response](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/responsemetadata.html), useful for debugging.
   */
  metadata: ResponseMetadata;
  /**
   * An error is defined here as all responses that don't have a `2xx` status, meaning the
   * request was sent and a response was received.
   *
   * The `error` object is whatever was thrown by the `S3Client.send` function.
   *
   * In the case where the request was not sent or no response received (for example when `S3Client`
   * is not configured correctly or there is no internet connection, etc...), the `s3Get` function
   * will re-throw the error from the `S3Client`, and won't return it as value.
   */
  error?: any;
}
