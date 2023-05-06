# S3 Serve

![node-version](https://img.shields.io/node/v/s3-serve?style=plastic) ![CI/CD](https://github.com/AbdBarho/s3-serve/actions/workflows/node.js.yml/badge.svg)
[![npm version](https://badge.fury.io/js/s3-serve.svg)](https://badge.fury.io/js/s3-serve)



A node utility for serving files from S3. Compatible with Express, Fastify, NestJs, and more.

Small & flexible. You decide what and how to send and receive.

## Install
```bash
npm install s3-serve --save
```

This library has a *peer* dependency on `@aws-sdk/client-s3`, if not already installed, use the following:
```bash
npm install @aws-sdk/client-s3
```

## Getting Started

Minimal express example:
```js
import express from 'express';
import { S3Client } from '@aws-sdk/client-s3';
import { s3Get } from 's3-serve';

const client = new S3Client(...);
const app = express();

app.get('/:file', async (req, res) => {
  const { headers, body } = await s3Get(client, {
    Bucket: 'my-bucket',
    Key: req.params.file
  });
  res.set(headers);
  body.pipe(res);
})
```

More elaborate example [at the end!](#complex-example)

## Why?

There are many libraries that can help in serving file from S3, such as [s3-server](https://www.npmjs.com/package/s3-server), [s3-autoindex](https://www.npmjs.com/package/s3-autoindex),[s3-proxy](https://www.npmjs.com/package/s3-proxy), [simple-s3-proxy](https://www.npmjs.com/package/simple-s3-proxy), [s3-files](https://www.npmjs.com/package/s3-files), [s3-streams](https://www.npmjs.com/package/s3-streams) and many more.
Unfortunately, many of them are unmaintained, and the ones who are, are very restrictive in what the allow.

This library aims to be flexible by giving the developer full control over the inputs and outputs of each request, while also reducing the amount of boilerplate required when working with `@aws-sdk/s3-client`.



## API

### **s3Get**

_s3Get(client: [S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/s3client.html), options: [GetObjectCommandInput](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/getobjectcommandinput.html)): Promise\<[S3Response](./src/lib/S3Response.ts)>_

Executes a [GetObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/getobjectcommand.html) using the given client. Returns an [S3Response](./src/lib/S3Response.ts) which contains all information needed to serve the file.

Note: `s3Get` does neither cache nor store anything in memory, the requested file in `S3Response.body` is a `Readable` stream that can be piped as a response.

### **extractGetArgs**
_extractGetArgs(headers: object): object_

Extracts and converts relevant headers from a request, so they can be fed into `s3Get`'s `GetObjectCommandInput`.




## Complex example

Implement `express.static` but from s3 and with custom cache headers:

```js
import { s3Get, extractGetArgs } from 's3-serve';

app.get('/:key(*)', async (req, res) => {
  const response = await s3Get(client, {
    Bucket,
    Key: req.params.key || 'index.html',
    ...extractGetArgs(req.headers),
  });

  if (response.error) {
    const { error, metadata, statusCode, statusMessage } = response;
    console.error(`Error ${statusCode} getting ${Key}`, error, metadata);
    res.status(statusCode).send(statusMessage);
    return;
  }
  const { statusCode, headers, body } = response;
  res.status(statusCode).set(headers);

  if (/\.(jpg|png|gif)$/.test(Key)) {
    res.set('cache-control', 'max-age=3600');
  }

  body.pipe(res);
});
```
