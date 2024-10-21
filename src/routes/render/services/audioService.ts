import fs from 'fs'
import { Readable } from 'stream';
import { createAudioFileFromText } from './textToSpeachService';


async function processText(description: string, userId: string): Promise<string | null> {
    const publicDir = `./generate/${userId}`;

    console.log(description.length);

    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
        console.log(`Папка ${publicDir} создана.`);
    }

    if (description.length > 3900) {
        throw new Error('Текст слишком длинный. Допустимая длина — до 3900 символов.');
    }
    const singleAudioFile = await createAudioFileFromText(description, publicDir);
    return singleAudioFile;
}

export { processText }