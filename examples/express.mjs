import { S3Client } from '@aws-sdk/client-s3';
import Express from 'express';
import dotenv from 'dotenv';
import { s3Get, extractGetArgs } from '../build/index.js';

dotenv.config();

const app = Express();
const client = new S3Client({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.KEY,
    secretAccessKey: process.env.SECRET,
  },
});
const Bucket = process.env.BUCKET;

app.get('/:key(*)', async (req, res) => {
  let Key = req.params.key;
  if (Key === '') {
    Key = 'index.html';
  }
  const response = await s3Get(client, {
    Bucket,
    Key,
    ...extractGetArgs(req.headers),
  });
  if (response.error) {
    const { error, metadata, statusCode, statusMessage } = response;
    console.error(`Error getting ${Key}`, error, metadata);
    return res.status(statusCode).send(statusMessage);
  }
  const { body, statusCode, headers } = response;
  res.status(statusCode).set(headers);
  // cache if its media
  if (/\.(jpg|png|webp|mp4)$/.test(Key)) {
    res.set('cache-control', 'max-age=3600');
  }
  body.pipe(res);
});
app.listen(5500);
console.log('app running on ' + 5500);
