import dotenv from 'dotenv';
import {createWriteStream } from 'fs'
import https from 'https'
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
import { promises as fs } from 'fs';

dotenv.config();

import { model } from './geminiService';
import { uploadVideoToS3 } from './s3/s3-module';

export async function getVideos(fullText, duration, userId) {
  console.log(userId);
  
  console.log(duration);
  
  const promptMain = `
Task:
Based on the total audio duration, calculate how many video segments (each 5 seconds long) can be created. For each segment, generate a corresponding part of the description ensuring it adheres to the specifications mentioned. The result should be a list of unique Video objects where each Video contains a 'title' in English. The title should consist of one or two words, depending on the clarity and context. Use one word when it's sufficient to clearly represent the key object or subject. If one word is not enough, use two words to provide necessary clarity. Ensure the titles follow the sequence of the news story, reflecting the storyline.

Make sure each title:
- Consists of one or two words (e.g., "Cucumber", "Lion", "Urban Park");
- Avoids using more than two words and commas;
- Follows the flow of the news description, maintaining the correct sequence of events;
- Focuses on specific, easily searchable objects, places, or entities that are common on stock video platforms;
- Is simple, relevant, and easy to visualize.

Generate ${Math.ceil(duration/5)} unique and relevant titles for the topic provided in the description, reflecting the sequence of the news story.

Input JSON:
{
    "description": "${fullText}",
    "allDuration": ${duration}
}

Output Schema:
Return a list[Video] where each Video = {"title": str}

  `;

  const promptResult = await model.generateContent(promptMain);
  const text = promptResult.response.text();

  console.log(text);

  const jsonResult = JSON.parse(text);
  let videoCount = 1;
  const videos: string[] = []


  for (const res of jsonResult) {
      const video = await getVideoId(res.title);
      
      if(video){
        console.log(video);
        const mainVideo = await searchVideos(video, userId)
        videos.push(mainVideo)
      } else{
        const newVideo = await hasTitle(res.title)
        if(newVideo){
          const mainVideo = await searchVideos(newVideo, userId)
          videos.push(mainVideo)
        }
        console.log(newVideo);

      }
      
      videoCount++;
  }
  console.log(videos);

  return videos
}

async function getSessionId() {
  return await fetch(`http://api.depositphotos.com?dp_apikey=${process.env.DEPOSIT}&dp_command=loginAsUser&dp_login_user=${process.env.LOGIN}&dp_login_password=${process.env.PASSWORD}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(async response => { 
    const data = await response.json(); 
    console.log("Session: " + data.sessionid);
    return data.sessionid;
  })
  .catch(error => {
    console.error(error);
    return null;
  });
}

async function getVideoId(query: string) {
  return await fetch(`http://api.depositphotos.com?dp_apikey=${process.env.DEPOSIT}&dp_command=search&dp_search_query=${query}&dp_search_photo=false&dp_search_sort=1&dp_search_vector=false&dp_search_editorial=false&dp_search_video=true&dp_search_orientation=vertical`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(async response => { 
    const data = await response.json(); 
    
    console.log("LENGTH: " + data.result.length);

    const elems: string[] = []
     
    if (data.result.length > 0) {
      for (const el of data.result) {
        if (el.royalty_model !== 'cpa') {
          elems.push(el.id)
        }
      }
      const randomIndex = Math.floor(Math.random() * elems.length);
      return elems[randomIndex];
    } else {
      throw new Error('No result found');
    }
  })
  .catch(error => {
    console.error(error);
    return null;
  });
}

async function searchVideos(mediaId: string, userId: string): Promise<any> {
  console.log("MEDIA: " + mediaId);
  
  const sessionId = await getSessionId()
  return await fetch(`http://api.depositphotos.com?dp_apikey=${process.env.DEPOSIT}&dp_command=getMedia&dp_session_id=${sessionId}&dp_media_id=${mediaId}&dp_media_option=hd720&dp_media_license=standard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(async response => { 
    const data = await response.json(); 
    console.log(data);
    
    console.log("LINK: " + data.downloadLink);

    const outputFilePath = `./generate/${userId}/video.mp4`;

    const filepath = await downloadFileWithTimeout(data.downloadLink, outputFilePath, 6000000)
    .then((filePath) => {return filePath})
    .catch((err) => console.error(err));

    const outputSmallFilePath = `./generate/${userId}/video-small.mp4`

    await processVideo(filepath, outputSmallFilePath);



    const final = await uploadVideoToS3({file: outputSmallFilePath, bucketName: process.env.AWS_BUCKET_NAME as string})

    await fs.unlink(outputFilePath);
    await fs.unlink(outputSmallFilePath);

    console.log(final);
    

    return final;
  })
  .catch(error => {
    console.error(error);
    return null;
  });

}
  
async function hasTitle(title: string, attempts = 0, maxAttempts = 20) {
  console.log("Cannot find: " + title);
  
  if (attempts >= maxAttempts) {
    throw new Error('Max attempts reached, unable to generate a valid title.');
  }

  try {
    const result = await model.generateContent(`Generate a unique and clear title that is different from 'undefined', 'untitled', or similar vague terms. The title should be simple and meaningful. Title should be even simpler than ${title}. Reduce the number of words.`);
    
    const text = await result.response.text();
    const jsonResult = JSON.parse(text);

    if (!jsonResult) {
      throw new Error('No title found in response.');
    }

    const video = await getVideoId(jsonResult);
    
    if (video) {
      return video;
    } else {
      return await hasTitle(jsonResult, attempts + 1); 
    }
  } catch (error) {
    console.error(error);
    return null; 
  }
}

function downloadFileWithTimeout(url, outputFilePath, timeoutDuration = 30000) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(outputFilePath);
    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(outputFilePath);
        });
      } else {
        reject(new Error(`Ошибка: статус ответа ${response.statusCode}`));
      }
    });

    request.setTimeout(timeoutDuration, () => {
      request.abort();
      reject(new Error(`Ошибка: сервер не отправил данные в течение ${timeoutDuration / 1000} секунд`));
    });

    request.on('error', (err) => {
      reject(new Error(`Ошибка при загрузке: ${err.message}`));
    });
  });
}

function processVideo(filepath, outputSmallFilePath) {
  return new Promise((resolve, reject) => {
    ffmpeg(filepath)
      .setStartTime('00:00:03')
      .setDuration('10')
      .output(outputSmallFilePath)
      .on('end', function() {
        console.log('conversion Done: ' + outputSmallFilePath);
        resolve(outputSmallFilePath);
      })
      .on('error', function(err) {
        console.log('error: ', err);
        reject(err);
      })
      .run();
  });
}