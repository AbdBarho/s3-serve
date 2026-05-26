import {
  GetObjectCommand,
  type GetObjectCommandInput,
  type GetObjectCommandOutput,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import type { DeserializeMiddleware, HttpResponse, ResponseMetadata } from '@aws-sdk/types';
import type { IncomingHttpHeaders } from 'http';
import { Readable } from 'node:stream';
import { splitResponseHeaders, HEADER_TO_PARAM, valueToType } from './headers.ts';
import type { S3Response } from './S3Response.ts';

function isHttpResponse(response: unknown): response is HttpResponse {
  return typeof response === 'object' && response !== null && 'statusCode' in response && 'headers' in response;
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
export async function s3Get(client: S3Client, options: GetObjectCommandInput): Promise<S3Response> {
  const command = new GetObjectCommand(options);

  // The status, status message and headers must come from the raw HTTP response, not the
  // body: the SDK may wrap the body in a checksum-validating stream, so it is not always the
  // underlying IncomingMessage. On success the raw response is only reachable via middleware;
  // on error it is exposed on the exception. Both are the same `HttpResponse` shape.
  let httpResponse: HttpResponse | undefined;
  const captureResponse: DeserializeMiddleware<GetObjectCommandInput, GetObjectCommandOutput> = next => async args => {
    const result = await next(args);
    if (isHttpResponse(result.response)) {
      httpResponse = result.response;
    }
    return result;
  };
  command.middlewareStack.add(captureResponse, { step: 'deserialize', name: 's3ServeCaptureResponse' });

  let body: GetObjectCommandOutput['Body'];
  let metadata: ResponseMetadata;
  let error: S3ServiceException | undefined;

  try {
    const response = await client.send(command);
    body = response.Body;
    metadata = response.$metadata;
    error = undefined;
  } catch (exception) {
    if (!(exception instanceof S3ServiceException) || !exception.$response) {
      throw exception;
    }
    httpResponse = exception.$response;
    body = exception.$response.body;
    metadata = exception.$metadata;
    error = exception;
  }

  if (!httpResponse) {
    throw new Error('s3-serve: could not read the raw S3 HTTP response');
  }
  if (!(body instanceof Readable)) {
    throw new Error('s3-serve: the S3 response body is not a readable stream');
  }

  const { statusCode, reason, headers: rawHeaders } = httpResponse;
  const { headers, s3Headers } = splitResponseHeaders(rawHeaders);
  return {
    body,
    statusCode,
    statusMessage: reason ?? '',
    headers,
    s3Headers,
    metadata,
    error,
  };
}

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
export function extractGetArgs(headers: IncomingHttpHeaders): Partial<GetObjectCommandInput> {
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    const paramName = HEADER_TO_PARAM[key.toLowerCase()];
    if (paramName) {
      output[paramName] = valueToType(paramName, value);
    }
  }
  return output;
}
