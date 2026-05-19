import { GetObjectCommand, GetObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { splitResponseHeaders, HEADER_TO_PARAM, Headers, valueToType } from './headers';
import { S3Response } from './S3Response';

/**
 * The transport-level HTTP response exposed by the AWS SDK
 * (`@smithy/protocol-http`'s `HttpResponse`).
 *
 * `s3-serve` reads the response status and headers from this object instead of
 * from the deserialized command output: the command output only exposes a typed
 * subset of headers, and the way responses (including streaming bodies) are
 * deserialized changed in `@aws-sdk/client-s3` 3.931.0 with the move to
 * schema-based serde. This transport-level contract is stable across that change.
 */
interface RawHttpResponse {
  statusCode: number;
  reason?: string;
  headers: Headers;
  body: IncomingMessage;
}

/**
 * Get a file from S3
 *
 * @param {S3Client} client The [S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/s3client.html) used for making requests.
 * @param {GetObjectCommandInput} options [Input](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/getobjectcommandinput.html)
 * for the {@link GetObjectCommand}, these are passed without any modifications.
 *
 * You can use the {@link extractGetArgs} function to extract all relevant parameters from
 * request headers and pass them to this function.
 * See the docs for {@link extractGetArgs} for an example.
 * @returns response object, see {@link S3Response} for more info on the contents and usage.
 *
 */
export const s3Get = async (client: S3Client, options: GetObjectCommandInput): Promise<S3Response> => {
  const command = new GetObjectCommand(options);

  // Capture the raw HTTP response. A `deserialize`-step middleware observes the
  // transport-level response, which is independent of how the command output is
  // (de)serialized, so it is not affected by the SDK's schema-serde changes.
  let captured: RawHttpResponse | undefined;
  command.middlewareStack.add(
    (next: any) => async (args: any) => {
      const result = await next(args);
      captured = result.response;
      return result;
    },
    { step: 'deserialize', priority: 'low', name: 's3ServeCaptureResponse' }
  );

  let httpResponse: RawHttpResponse;
  let metadata, error;
  try {
    const response = await client.send(command);
    // The middleware always runs when `send` resolves.
    httpResponse = captured as RawHttpResponse;
    metadata = response.$metadata;
  } catch (exception: any) {
    if (!exception.$response) {
      throw exception;
    }
    // `$response` is itself the `HttpResponse` for the failed request.
    httpResponse = exception.$response;
    metadata = exception.$metadata;
    error = exception;
  }

  const { body, statusCode, reason, headers: baseHeaders } = httpResponse;
  const { headers, s3Headers } = splitResponseHeaders(baseHeaders);
  return { body, statusCode, headers, s3Headers, statusMessage: reason ?? '', metadata, error };
};

/**
 * Extracts relevant headers and convert them to be compatible with {@link GetObjectCommandInput}
 *
 * example with express
 * ```js
 * app.get('/:file', async (req, res) => {
 *   const { headers, body } = await s3Get(client, {
 *      Bucket,
 *      Key,
 *      ...extractGetArgs(req.headers)
 *   })
 * })
 * ```
 *
 * @param headers headers of an incoming request, usually from a browser.
 * @returns object containing addition parameters that could be passed to {@link s3Get}
 */
export const extractGetArgs = (headers: IncomingHttpHeaders): Partial<GetObjectCommandInput> => {
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    const paramName = (HEADER_TO_PARAM as Headers)[key.toLowerCase()];
    if (paramName) {
      output[paramName] = valueToType(paramName, value);
    }
  }
  return output;
};
