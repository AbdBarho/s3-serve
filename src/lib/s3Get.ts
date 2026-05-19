import { GetObjectCommand, GetObjectCommandInput, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import type { ResponseMetadata } from '@aws-sdk/types';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { splitResponseHeaders, HEADER_TO_PARAM, valueToType } from './headers';
import { S3Response } from './S3Response';

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
  let body: unknown;
  let metadata: ResponseMetadata;
  let error: S3ServiceException | undefined;

  try {
    const response = await client.send(new GetObjectCommand(options));
    body = response.Body;
    metadata = response.$metadata;
    error = undefined;
  } catch (exception) {
    if (!(exception instanceof S3ServiceException) || !exception.$response) {
      throw exception;
    }
    body = exception.$response.body;
    metadata = exception.$metadata;
    error = exception;
  }

  if (!(body instanceof IncomingMessage) || body.statusCode === undefined) {
    throw new Error('s3-serve: the S3 response body is not a readable HTTP message');
  }

  const { statusCode, statusMessage, headers: rawHeaders } = body;
  const { headers, s3Headers } = splitResponseHeaders(rawHeaders);
  return { body, statusCode, statusMessage: statusMessage ?? '', headers, s3Headers, metadata, error };
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
    const paramName = HEADER_TO_PARAM[key.toLowerCase()];
    if (paramName) {
      output[paramName] = valueToType(paramName, value);
    }
  }
  return output;
};
