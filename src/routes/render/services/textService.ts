import { model } from "./geminiService";

function escapeQuotesInsideValues(text: string): string {
  return text.replace(/:\s*"(.*?)"/g, (match, p1) => {
    // Экранируем только кавычки внутри значений, а не синтаксические кавычки
    const escapedValue = p1.replace(/(?<!\\)"/g, '\\"');
    return `: "${escapedValue}"`;
  });
}

export async function generateFullText(title: string, description: string): Promise<{ description: string } | null>{
  const promptFullText = `
  {
  "title": "${title}.",
  "description": "${description}"
}

Task:

Generate a text that combines the title and description from the input data, while:

  НЕ ИСПОЛЬЗУЙ ЗНАК ** В ТЕКСТЕ НИКОГДА

  1. Summarize the text, keeping only the main essence, not exceeding 500 characters. Retain key points while cutting out secondary details and unnecessary specifics. All important quotes should be preserved without changes, but their length and wording can be adapted for brevity. The tone should remain respectful and neutral for serious topics; in other cases, light humor can be added to engage the reader. It's very important. TEXT MUST BE SHORT
  2. The summary must remain faithful to the key message, but feel free to make the language fun and accessible for the reader.
  3. The summary should be short, concise, and written in your own words, capturing the essence of the original text.
  4. Rewrite the original text to reduce it to one minute.
  5. Perform the rewrite strictly following the "inverted pyramid" principle for readability.
  6. KEEP QUOTES from officials and persons unchanged, although you may trim the beginning or end if it doesn't distort the meaning.
  7. When quoting direct speech, if the quoted paragraph is too long, you may split it into smaller paragraphs and PARAPHRASE CERTAIN PARTS, but the quote must always be included if it exists in the original text.
  8. EXCLUDE all references to images.
  9. DO NOT INCLUDE text after the phrases "читайте также" or "read on."
  10. ALL TEXT MUST BE IN RUSSIAN LANGUAGE.
  11. ADD HUMOR: Inject friendly, light-hearted humor or mild sarcasm when appropriate, but AVOID any jokes if the text involves criminal cases, accidents, or instances where people have suffered.
  12. NO JOKES ABOUT THE PRESIDENT OF KAZAKHSTAN, KASSYM-JOMART TOKAYEV.
  13. Respect context: jokes should be aimed at making the text more engaging without undermining the facts or seriousness where necessary.

What Not To Do
- DO NOT add humor in cases of criminal investigations, accidents, or sensitive topics involving harm to individuals.
- NEVER make jokes about the President of Kazakhstan, Kassym-Jomart Tokayev, or his administration.
- AVOID distorting the meaning of quotes from officials or key figures.
- DO NOT include references to images or external links.
- AVOID overloading the text with jokes or sarcasm that distracts from the core message or facts.

Examples
1. If it's a corruption scandal: «Похоже, что кто-то решил, что мешки денег — это слишком скучно, и нужно делать ситуацию более захватывающей. Но прокуратура явно не оценила креативный подход...»
2. If it's about political intrigue: «Когда они говорят, что политика — это шахматы, не все понимают, что иногда приходится играть с закрытыми глазами и под дождем. Кажется, один из игроков уже начал промокать…»

Edge Cases
- For serious, fact-driven reports, such as natural disasters or tragic incidents, KEEP THE TONE NEUTRAL and respectful.
- When referencing specific figures or direct statements, make sure humor does not overshadow the key information.



using this JSON schema:

{
  "type": "object",
  "properties": {
    "description": { "type": "string" },
  }
}
  `;

  try{


    const promptResult = await model.generateContent(promptFullText);

    console.log(promptResult.response.text());
    
    let text = promptResult.response.text();

    text = escapeQuotesInsideValues(text);

    console.log(text);
    

    const jsonResult = JSON.parse(text);

    return jsonResult
  } catch(error){    
    console.log(error);
    return null
  }
}