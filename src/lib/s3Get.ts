import { GetObjectCommand, GetObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { IncomingHttpHeaders } from 'http';
import { splitResponseHeaders, HEADER_TO_PARAM, Headers, valueToType } from './headers';
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
  let body, metadata, error;
  try {
    const response = await client.send(new GetObjectCommand(options));
    body = response.Body;
    metadata = response.$metadata;
  } catch (exception: any) {
    if (!exception.$response) {
      throw exception;
    }
    body = exception.$response.body;
    metadata = exception.$metadata;
    error = exception;
  }

  const { statusCode, headers: baseHeaders, statusMessage } = body;
  const { headers, s3Headers } = splitResponseHeaders(baseHeaders);
  return { body, statusCode, headers, s3Headers, statusMessage, metadata, error };
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
