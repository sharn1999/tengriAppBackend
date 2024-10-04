import axios from 'axios';
import { Agent } from 'https';
import { stringify } from 'qs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs'

import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const instance = axios.create({
    httpsAgent: new Agent({ rejectUnauthorized: false })
});

async function getAccessToken() {
    const url = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    const authData = Buffer.from(`${process.env.SBER_ID}:${process.env.SBER_SECRET}`).toString('base64');

    const uniqueRqUID = uuidv4();

    try {
        const response = await instance.post(url, stringify({ scope: 'SALUTE_SPEECH_PERS' }), {
            headers: {
                'Authorization': `Basic ${authData}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'RqUID': uniqueRqUID
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Ошибка при получении токена:', error);
        return null;
    }
}

async function synthesizeSpeech(text: string, isLocal: boolean, publicDir: string): Promise<string | null> {
    const accessToken = await getAccessToken();


    if (!accessToken) {
        console.log('Не удалось получить токен доступа.');
        return null;
    }
    const url = 'https://smartspeech.sber.ru/rest/v1/text:synthesize';
    const params = {
      format: 'wav16',
      voice: ['Bys_24000', 'May_24000']
    };

    try {

      const response = await instance.post(`${url}?format=${params.format}&voice=${params.voice[Math.floor(Math.random() * params.voice.length)]}`, text, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/text'
        },
        responseType: 'arraybuffer'
      });

      if(isLocal){
        const localFile = await saveAudioLocallFile(response.data)
        return localFile
      } else{
        await saveAudioLocally(response.data, publicDir)
        return `${publicDir}/audio.wav`;
      }
    } catch (error) {
      console.log("textToSpeech error: " + error);
      return null
    }
}

async function saveAudioLocally(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>, publicDir:string) {
  const directory = `${publicDir}`;
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    console.log(`Папка ${directory} создана.`);
  }
  return new Promise((resolve, reject) => {
    const filePath = path.join(directory, 'audio.wav');
    fs.writeFile(filePath, Buffer.from(data), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(`Файл успешно сохранен: ${filePath}`);
      }
    });
  });
}

async function saveAudioLocallFile(data: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>): Promise<string> {
  const finalLocal = `./audio-${Date.now()}.wav`
  return new Promise((resolve, reject) => {
    fs.writeFile(finalLocal, Buffer.from(data), (err) => {
      if (err) {
        reject(err);
      } else {
        console.log("Файл успешно сохранен");
        resolve(finalLocal);
      }
    });
  });
}


export { synthesizeSpeech };