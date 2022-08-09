import Fastify from 'fastify';
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

import { s3Get, extractGetArgs } from '../build/index.js';

dotenv.config();

const client = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.KEY,
    secretAccessKey: process.env.SECRET,
  },
});
const Bucket = process.env.BUCKET;

const fastify = Fastify({ logger: true });

fastify.get('/*', async (req, res) => {
  let Key = req.url.slice(1);
  if (Key === '') {
    Key = 'index.html';
  }
  const { body, statusCode, headers } = await s3Get(client, {
    Bucket,
    Key,
    ...extractGetArgs(req.headers),
  });

  res.status(statusCode).headers(headers);
  return body;
});

fastify.listen({ port: 5500 }).then(str => {
  console.log('app running on', str);
});
