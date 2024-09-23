import axios from 'axios';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import fs from 'fs-extra';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash",    
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE
    },
  ]});

const baseUrl = 'https://api.assemblyai.com/v2';

const headers = {
  authorization: process.env.SUBTITLES_API,
};

const generateSubtitles = async (audioUrl: string, original: string, userId: string) => {
  const pathAudio = audioUrl;
 
  const audioData = await fs.readFile(pathAudio);
  const uploadResponse = await axios.post(`${baseUrl}/upload`, audioData, {
    headers,
  });
  const uploadUrl = uploadResponse.data.upload_url;
  const data = {
    audio_url: uploadUrl,
    language_code: 'ru',
  };

  const url = `${baseUrl}/transcript`;
  const response = await axios.post(url, data, { headers });

  const transcriptId = response.data.id;
  const pollingEndpoint = `${baseUrl}/transcript/${transcriptId}`;

  while (true) {
    const pollingResponse = await axios.get(pollingEndpoint, {
      headers,
    });
    const transcriptionResult = pollingResponse.data;

    if (transcriptionResult.status === 'completed') {
      break;
    } else if (transcriptionResult.status === 'error') {
      throw new Error(`Transcription failed: ${transcriptionResult.error}`);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  let subtitles = await getSubtitleFile(transcriptId, 'srt');

  const correctedSubtitles = await correctSubtitlesWithGemini(subtitles, original);

  const subtitlesPath = `./generate/${userId}/subtitles.srt`;

  await fs.mkdir(path.dirname(subtitlesPath), { recursive: true });
  

  await fs.writeFile(subtitlesPath, correctedSubtitles);

  return subtitlesPath;
};

async function getSubtitleFile(transcriptId: any, fileFormat: string) {
  if (!['srt', 'vtt'].includes(fileFormat)) {
    throw new Error(
      `Unsupported file format: ${fileFormat}. Please specify 'srt' or 'vtt'.`
    );
  }

  const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}/${fileFormat}`;

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to retrieve ${fileFormat.toUpperCase()} file: ${error}`
    );
  }
}


async function correctSubtitlesWithGemini(subtitles: any, original: string) {
  const promptFullText = `Это весь текст субтитров с ошибками: ${subtitles}.
  А здесь полный текст без ошибок: ${original}. Твоя задача заменить только слова из неправильного текста на слова из правильного. И не добавлять никуда символы **. Самое важное не добавлять символы **  возвращать ты должен текст в том же формате, например: 1
  00:00:00,148 --> 00:00:03,570
  В Актобе суд обязал курьера выплатить 3 миллиона тенге-пенсионерке,
  
  2
  00:00:03,610 --> 00:00:07,211
  ставшей жертвой мошенников. Как стало известно из материалов дела,`;
  
  try {
    const promptResult = await model.generateContent(promptFullText);
    const text = promptResult.response.text();
    return text
  } catch (error) {
    throw new Error(`Failed to correct subtitles: ${error}`);
  }
}

export { generateSubtitles };