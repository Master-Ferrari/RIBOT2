const { G4F, chunkProcessor } = require("g4f");
import {wait} from "./libs/discordUtils";
const g4f = new G4F();
const messages = [
    { role: "system", content: "You're an expert bot in poetry." },
    { role: "user", content: "Let's see, write a six paragraph-long poem for me." },
];
const options = {
    // provider: g4f.providers.Bing,
    stream: true,
    chunkSize: 5,
    retry: {
        times: 3,
        condition: (text: string) => {
            const words = text.split(" ");
            return words.length > 2;
        }
    },
    output: (text: string) => {
        return text + " 💕🌹";
    }
};
const period = 100;
(async () => {
    const response = await g4f.chatCompletion(messages, options);
    for await (const chunk of chunkProcessor(response)) {


        const startTime = Date.now();
        console.log(chunk);
        const endTime = Date.now();
        const elapsed = endTime - startTime;
        if (elapsed < period) {
            await wait(period - elapsed);
        }
    }
})();