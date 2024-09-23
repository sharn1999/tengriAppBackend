import dotenv from 'dotenv';

dotenv.config();

import { createClient } from "pexels";
import { model } from './geminiService';

const client = createClient(process.env.PEXELS_API as string);

interface VideoSearchResult {
  videos: {
    video_files: {
      link: string;
      width: number
    }[];
  }[];
}

export async function getVideos(fullText, duration) {

  
  const promptMain = `
  Task:
    Based on the total audio duration, calculate how many video segments (each 5 seconds long) can be created. For each segment, generate a corresponding part of the description ensuring it adheres to the specifications mentioned. The result should be a list of unique Video objects where each Video contains a 'title' in English with maximum description in 3-4 words. Ensure each title is relevant to the context of the news description provided and suitable for finding stock videos. Do not use any names or colons. Each title should be concise and clear.
  
    Generate ${Math.ceil(duration/3)} unique and relevant titles for the topic provided in the description.
  
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
      const video = await searchVideos(res.title);
      
      if(video){
        console.log(video);
        videos.push(video)
      } else{
        const newVideo = await hasTitle(res.title)
        console.log(newVideo);
        videos.push(newVideo)
      }
      
      videoCount++;
  }
  console.log(videos);

  return videos
}

async function searchVideos(query: string): Promise<string | null> {
    try {
        const response = await client.videos.search({ query, size: "medium" }) as VideoSearchResult;
        const videosLength = response.videos.length;
        if (videosLength > 0) {

          let random = 0

          if(videosLength > 5){
            random = Math.floor(Math.random() * 5)
          } else{
            random = Math.floor(Math.random() * videosLength)
          }

            let url: string | null = null;

            let max = response.videos[random].video_files[0].width

            response.videos[random].video_files.forEach((el, i) => {
              
              if(max < el.width && el.width < 2600){
                max = el.width;
                url = el.link
              }
            })  
            return url;
        } else {
            console.log('No videos found for the query:', query);
            return null;
        }
    } catch (error) {
        console.error('Search failed:', error);
        return null;
    }
}
  
async function hasTitle(title: string){
    console.log("Cannot find: " + title);
    
    const result = await model.generateContent(`generate a simpler title, only one another title for this title: ${title}. DON'T USE UNDEFINED`);
    const text = result.response.text();
    const jsonResult = JSON.parse(text);
    const video = await searchVideos(jsonResult.title);
    if (video) {
      return video
    } else {
      return await hasTitle(jsonResult.title)
    }
  }
