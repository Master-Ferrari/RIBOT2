import axios from 'axios';
import { openaikey } from "./botConfig.json"

async function main() {
  try {

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ],
      stream: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaikey}`
      }
    });

    for (const chunk of response.data) {
      console.log(chunk.choices[0].delta.content);
    }
  } catch (error) {
    console.error(error);
  }
}

main();