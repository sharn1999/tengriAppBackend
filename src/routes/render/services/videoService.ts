import dotenv from 'dotenv';
import {createWriteStream } from 'fs'
import https from 'https'
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
import { promises as fsP } from 'fs';
import fs from 'fs'

dotenv.config();

import { model } from './geminiService';
import { uploadVideoToS3 } from './s3/s3-module';
import axios from 'axios';

export async function getVideos(fullText, duration, userId) {
  console.log(userId);
  
  console.log(duration);
  
//   const promptMain = `
// Task:
// Based on the total audio duration, calculate how many video segments (each 5 seconds long) can be created. For each segment, generate a corresponding part of the description ensuring it adheres to the specifications mentioned. The result should be a list of unique Video objects where each Video contains a 'title' in English. The title should consist of one or two words, depending on the clarity and context. Use one word when it's sufficient to clearly represent the key object or subject. If one word is not enough, use two words to provide necessary clarity. Ensure the titles follow the sequence of the news story, reflecting the storyline.

// Make sure each title:
// - Consists of one or two words (e.g., "Cucumber", "Lion", "Urban Park");
// - Avoids using more than two words and commas;
// - Follows the flow of the news description, maintaining the correct sequence of events;
// - Focuses on specific, easily searchable objects, places, or entities that are common on stock video platforms;
// - Is simple, relevant, and easy to visualize.

// Generate ${Math.ceil(duration/5)} unique and relevant titles for the topic provided in the description, reflecting the sequence of the news story.

// Input JSON:
// {
//     "description": "${fullText}",
//     "allDuration": ${duration}
// }

// Output Schema:
// Return a list[Video] where each Video = {"title": str}

//   `;

//   const promptResult = await model.generateContent(promptMain);
//   const text = promptResult.response.text();

//   console.log(text);

//   const jsonResult = JSON.parse(text);

  const jsonResult = await getVideosImproved(fullText, duration, userId)
  console.log(jsonResult);
  
  let videoCount = 1;
  const videos: any = []

  for (const res of jsonResult) {
      const video = await getVideoId(res.title, res.context);
      
      if(video){
        console.log(video);
        const mainVideo = await searchVideos(video, userId)
        const tempObj = {link: mainVideo, source: "depositPhotos"}
        videos.push(tempObj)
      } else{
        const newVideo = await hasTitle(res.title, res.context)
        if(newVideo){
          const mainVideo = await searchVideos(newVideo, userId)
          const tempObj = {link: mainVideo, source: "depositPhotos"}
          videos.push(tempObj)
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

async function getVideoId(query: string, context) {
  return await fetch(`http://api.depositphotos.com?dp_apikey=${process.env.DEPOSIT}&dp_command=search&dp_search_query=${query}&dp_search_photo=false&dp_search_sort=1&dp_search_vector=false&dp_search_editorial=false&dp_search_video=true&dp_search_orientation=vertical&dp_search_sort=1&dp_search_limit=50`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(async response => { 
    const data = await response.json(); 
    
    console.log("LENGTH: " + data.result.length);

    const elems: {id: string, thumb_max: string}[] = [];
    
    if (data.result.length > 0) {
      for (const el of data.result) {
        if (el.royalty_model !== 'cpa') {
          elems.push(el);
        } 
      }

      console.log("start vision");

      const imageParts: Array<any> = [];

      // Цикл по элементам
      for (const el of elems) {
        console.log("start part");
        
        try {
          const part = await fileToGenerativePart(el.thumb_max, "image/jpg");
          imageParts.push(part);
        } catch (error) {
          console.error(`Failed to process element: ${el.id}. Skipping to the next.`);
          continue; // Переход на следующую итерацию
        }
      }

      // Проверка, если imageParts пустой
      if (imageParts.length === 0) {
        throw new Error('imageParts is empty. Failed to generate any parts.');
      }

      
      // Продолжение выполнения
      const promptImages = `Найди наиболее подходящую заголовку: ${query} \n и учитывая контекст: ${context} \n картинку и верни ее индекс начиная отсчёт с 0
      
      using this JSON schema:

      {
        "type": "object",
        "properties": {
          "index": { "type": "number" },
        }
      }
      `;

      const generatedContent = await model.generateContent([promptImages, ...imageParts]);

      const textResponse = await generatedContent.response.text();

      const finalVideo = JSON.parse(textResponse);

      const index = finalVideo.index;

      console.log("index:" + index);

      return elems[Number(index)].id;
    } else {
      throw new Error('No result found');
    }
  })
  .catch(error => {
    console.error(error);
    return null;
  });
}


async function fileToGenerativePart(path, mimeType) {
  const response = await axios.get(path, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data, 'binary');

  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
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

    await fsP.unlink(outputFilePath);
    await fsP.unlink(outputSmallFilePath);

    console.log(final);
    

    return final;
  })
  .catch(error => {
    console.error(error);
    return null;
  });

}
  
async function hasTitle(title: string,context: string, attempts = 0, maxAttempts = 20) {
  console.log("Cannot find: " + title);
  
  if (attempts >= maxAttempts) {
    throw new Error('Max attempts reached, unable to generate a valid title.');
  }

  try {
    const result = await model.generateContent(`Generate a unique and clear title that is different from 'undefined', 'untitled', or similar vague terms. The title should be simple and meaningful. Title should be even simpler than ${title}. Reduce the number of words. On Russian`);
    
    const text = await result.response.text();
    const jsonResult = JSON.parse(text);

    if (!jsonResult) {
      throw new Error('No title found in response.');
    }

    const video = await getVideoId(jsonResult, context);
    
    if (video) {
      return video;
    } else {
      return await hasTitle(jsonResult, context, attempts + 1); 
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
      .setStartTime('00:00:01')
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

async function getVideosImproved(fullText: string, duration: number, userId: string): Promise<{title: string, context: string}[]> {
  const segmentDuration = 5; // Длительность сегмента
  const totalSegments = Math.ceil(duration / segmentDuration);
  const textSegments = splitTextIntoSegments(fullText, totalSegments); // Функция для разбиения текста
  
  const videos: {title: string, context: string}[] = [];
  let previousContext = ''; // Для хранения контекста всех предыдущих сегментов

  console.log("segments: " + textSegments);
  
  for (let i = 0; i < textSegments.length; i++) {
    const segment = textSegments[i];

    const videoTitles = videos.map(video => video.title);
    
    const prompt = `
YOU ARE A VIDEO SEGMENTATION AND TITLE GENERATION EXPERT, SPECIALIZING IN THE ANALYSIS OF RUSSIAN VIDEO CONTENT. YOUR TASK IS TO GENERATE THE MOST RELEVANT, CONCISE TITLES THAT PERFECTLY MATCH THE SUBTITLES' THEMATIC CONTENT AND CONTEXT.

TASK TEMPLATE

Task: 
  Based on the following previous segments, generate a title for the current text segment. The title should be clear, short (one or two words), and directly reflect the content of the current segment, while maintaining the storyline from the previous segments. Only in Russian. Do not repeat the titles from the Previous array of titles. Не повторяй старые заголовки.

- Previous array of titles: ${videoTitles.join(', ')}
- Previous segments context: "${previousContext}"
- Current segment: "${segment}"

Return only the title as plain text, not as an object.

INSTRUCTIONS

1. ANALYZE THE CONTEXT:
   - THOROUGHLY ASSESS the provided previous segments to understand the storyline or central theme.
   - IDENTIFY any patterns, recurring ideas, or the tone of the overall content.

2. IDENTIFY THE CURRENT SEGMENT'S CORE THEME:
   - EXAMINE the current segment and DETERMINE its main idea.
   - CROSS-REFERENCE this main idea with the previous context to MAINTAIN consistency in narrative or theme.

3. GENERATE A TITLE:
   - CREATE a short (1-2 word) title that is a precise reflection of the current segment’s content.
   - AVOID repeating any of the titles from the provided list of previously generated titles.
   - DON'T REPEAT THE TITLES FROM THE ARRAY: ${videoTitles.join(', ')}

4. HANDLE EDGE CASES:
   - IF the current segment is too general or vague, USE the broader theme or main idea from the previous context to help GUIDE the title generation.
   - IF the current segment is redundant or repeats the previous segment, GENERATE a title that VARIES slightly while still capturing the essence of the new information.

EXAMPLES:

- Previous array of titles: ["Природа", "Горы", "Река"]
- Previous context: "Рассказ о походе через горную местность, полное описание горных вершин."
- Current segment: "Мы продолжили путь вдоль реки, наслаждаясь звуками воды."
  Generated title: "Река"

CHAIN OF THOUGHTS

1. UNDERSTAND: Review the previous context to ensure you grasp the storyline or thematic elements.
2. BASICS: Identify the core concept of the current segment.
3. BREAK DOWN: Cross-reference with the previous array of titles to ensure you do not repeat any titles.
4. ANALYZE: Focus on extracting the central idea of the current segment, even if it is implicit.
5. BUILD: Generate a title that captures the current segment’s essence, but is also informed by the broader narrative.
6. EDGE CASES: In case of overlap or vagueness, make sure the title still introduces a new, relevant element while avoiding redundancy.
7. FINAL TITLE: Ensure the title is clear, concise, and aligns with both the current segment and previous storyline.

What Not To Do
- NEVER generate overly broad or vague titles that do not directly reflect the segment's content.
- NEVER repeat or recycle titles from the previous array.
- NEVER ignore the broader context when crafting the title.
- NEVER create long or overly descriptive titles; keep them concise.
- NEVER repeat the titles from the Previous array of titles.
- AVOID generating titles that seem disconnected from the previous or current segment.

return result in format:

{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
  }
}


    `;

    try {
      const promptResult = await model.generateContent(prompt);
      const textResult = await promptResult.response.text().trim();

      const finalTitle = JSON.parse(textResult)

      console.log("RES: " + finalTitle.title);
      videos.push({
        "title": finalTitle.title,
        "context": segment
      });

      // Обновляем контекст, добавляя текущий сегмент к истории
      previousContext += ` ${segment}`;
      
    } catch (error) {
      console.error(`Ошибка при обработке сегмента текста: ${error}`);
    }
  }
  
  return videos;
}

function splitTextIntoSegments(fullText: string, totalSegments: number): string[] {
  const segmentLength = Math.ceil(fullText.length / totalSegments);
  const segments: string[] = [];
  for (let i = 0; i < fullText.length; i += segmentLength) {
    segments.push(fullText.slice(i, i + segmentLength));
  }
  return segments;
}