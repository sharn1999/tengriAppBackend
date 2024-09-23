import { model } from "./geminiService";


export async function generateFullText(title: string, description: string): Promise<{ description: string } | null>{
  const promptFullText = `
    Input JSON data:
    {
      "title": "${title}.",
      "description": "${description}"
    }

    Task:

    Generate a text that combines the title and description from the input data, while:
      1. You should write ALL description text, it's very important.
      2. Rewrite the original text to reduce it to one minute or slightly longer.
      3. Perform the rewrite strictly following the "inverted pyramid" principle for readability.
      4. Keep quotes from officials and persons unchanged, although you may trim the beginning or end if it doesn't distort the meaning.
      5. When quoting direct speech, if the quoted paragraph is too long, you may split it into smaller paragraphs and paraphrase certain parts, but the quote must always be included if it exists in the original text.
      6. Cut all references to images.
      7. Not including text after the phrases "читайте также" or "read on".
      8. All text should be in Russian language.
      Execution:
      Combine the title and description into one coherent piece, following the rules mentioned above. The result should be returned in JSON format with the key "description".
  `;

  try{


    const promptResult = await model.generateContent(promptFullText);
    const text = promptResult.response.text();

    const jsonResult = JSON.parse(text);

    return jsonResult
  } catch(error){    
    console.log(error);
    return null
  }
}