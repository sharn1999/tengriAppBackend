import {Upload} from '@aws-sdk/lib-storage'
import { s3Client } from '../middlewares/s3-middleware';
import fs from 'fs';
import fsp from 'fs/promises';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

interface UploadParams {
  file: string | Buffer;
  bucketName: string;
}

interface UploadVideoParams extends UploadParams {
  file: string; // Path to the video file
}

interface DeleteFileParams {
  key: string;
  bucketName: string;
}

async function uploadSubtitleToS3({ file, bucketName } : UploadParams) {
  const key = `subtitle-${Date.now()}.srt`;
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(file)
    }
  });

  await upload.done();
  
  return key;
}

async function uploadFileToS3({ file, bucketName } : UploadParams) {
    const fileContent = await fsp.readFile(file);
    const key = `audio-${Date.now()}.wav`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ACL: 'public-read'
      }
    });

    // const url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    await upload.done();
    
    return key;
}

async function uploadVideoToS3({ file, bucketName } : UploadVideoParams) {
  const key = `video-${Date.now()}.mp4`;
  const fileStream = fs.createReadStream(file);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: fileStream
    }
  });


  await upload.done();

  const url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  
  return url;
}

async function deleteFileFromS3({ key, bucketName } : DeleteFileParams) {
  const deleteParams = {
    Bucket: bucketName,
    Key: key,
  };

  const command = new DeleteObjectCommand(deleteParams);
  await s3Client.send(command);

  return `File with key ${key} deleted successfully from ${bucketName}`;
}


export { uploadFileToS3, uploadVideoToS3, uploadSubtitleToS3, deleteFileFromS3 };