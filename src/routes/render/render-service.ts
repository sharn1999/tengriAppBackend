import { renderMedia, selectComposition } from '@remotion/renderer';
import { promises as fs } from 'fs';
import { rm } from 'fs/promises';


import dotenv from 'dotenv';
import { generateFullText } from './services/textService';
import { processText } from './services/audioService';
import { deleteFileFromS3, uploadFileToS3, uploadSubtitleToS3, uploadVideoToS3 } from './services/s3/s3-module';
import { generateSubtitles } from './services/subtitlesService';
import { getVideos } from './services/videoService';

dotenv.config();

class RenderService {
  async startRender(videos, userId, audioLink, subtitlesLink, audioKey, subtitlesKey) {

    console.log(0);

    const compositionId = 'MyComp';
    const inputProps = {
        audioLink,
        subtitlesLink,
        videos,
      };

      console.log(1);
      
    
    

    const composition = await selectComposition({
        serveUrl: 'https://remotionlambda-useast1-ucflzjx2s0.s3.us-east-1.amazonaws.com/sites/my-video/index.html',
        id: compositionId,
        inputProps,
    });

    console.log(2);
    
    const outputLocation = `out/${userId}/${compositionId}.mp4`;
    try {

      console.log(3);
      
        await renderMedia({
            composition,
            serveUrl: 'https://remotionlambda-useast1-ucflzjx2s0.s3.us-east-1.amazonaws.com/sites/my-video/index.html',
            codec: 'h264',
            outputLocation,
            inputProps,
            timeoutInMilliseconds: 6000000,
        });

        console.log(4);
        
        
        await deleteFileFromS3({key: audioKey, bucketName: process.env.AWS_BUCKET_NAME as string});
        await deleteFileFromS3({key: subtitlesKey, bucketName: process.env.AWS_BUCKET_NAME as string});
        
        const finalOutput = await uploadVideoToS3({file: outputLocation, bucketName: process.env.AWS_BUCKET_NAME as string})

        await rm(`./out/${userId}`, { recursive: true, force: true });

        return finalOutput;
    } catch (error) {
      console.log("Error: " + error);
      
      throw new Error('Failed to fetch videos');
    }
  }

  async getText(title, description) {
    const fullText = await generateFullText(title, description);
    return fullText
  }

  async getAudio(text, userId){
    const audioLocal = await processText(text, userId);
  
    if(audioLocal && process.env.AWS_BUCKET_NAME){
      const audioKey = await uploadFileToS3({ file: audioLocal, bucketName: process.env.AWS_BUCKET_NAME })
      const audioLink = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${audioKey}`;

      return {audioLocal, audioLink, audioKey}
      
    }
  }
  
  async getSubtitles(audioLocal, text, userId){
    
    const subtitlesLink = await generateSubtitles(audioLocal, text, userId);
    
    if(subtitlesLink && process.env.AWS_BUCKET_NAME){
      const subtitlesContent = await fs.readFile(subtitlesLink);

      const subtitlesKey = await uploadSubtitleToS3({ file: subtitlesContent, bucketName: process.env.AWS_BUCKET_NAME })
      const link = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${subtitlesKey}`;

      const path = `./generate/${userId}`

      

      await rm(path, { recursive: true, force: true });
      
      return {subtitlesLink: link, subtitlesKey}
    }


  }
    
  async getVideos(text, duration){

    const videos = await getVideos(text, duration)
    return videos
  }
}

export default RenderService;

//npx remotion lambda sites create src/index.ts --site-name=my-video