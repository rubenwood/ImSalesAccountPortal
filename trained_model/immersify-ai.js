const express = require('express');
const immersifyAIRouter = express.Router();
const OpenAI = require('openai');

// Load your OpenAI API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

immersifyAIRouter.post("/generate", async (req, res) => {
    const { prompt } = req.body;

    try {
        const completion = await openai.chat.completions.create({
            model: "ft:gpt-4o-mini-2024-07-18:personal:immersify-ai:An41zLXV",
            messages: [{ role: "user", content: prompt }]
        });

        console.log(completion);
        console.log(completion.choices[0]);
        console.log(completion.choices[0].text);

        res.json({ result: completion.choices[0].text.trim() });
    } catch (error) {
        console.error("Error generating text:", error);
        res.status(500).send("Error generating text");
    }
});

async function generateBlogPost(prompt) {
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "immersify-blog-ai",
        });
        console.log("Generated Blog Post: ", completion.choices[0].text.trim());
    } catch (error) {
        console.error("Error generating blog post: ", error);
    }
}

//generateBlogPost("Write a blog post about the benefits of green tea:");

module.exports = { immersifyAIRouter };