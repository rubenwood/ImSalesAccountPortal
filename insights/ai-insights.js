const express = require('express');
const fs = require('fs');
const path = require('path');
const aiInsightsRouter = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});


aiInsightsRouter.post('/eventlog-insights', async (req, res) => {
    const eventLogData = req.body.eventLogs;

    const insights =  await generateAIInsights(eventLogData);
    res.json(insights);
});

async function generateAIInsights(filesToInterpret) {
    let fileList = [];
    for(filePath of filesToInterpret){
        const file = await openai.files.create({
            file: fs.createReadStream(filePath),
            purpose: "assistants",
        });
        fileList.push(file);
    }
    
    console.log(fileList[0].id);
    
    // Create an assistant using the file ID
    const assistant = await openai.beta.assistants.create({
        instructions: "Your are a data analyst, you will answer questions asked using the data files provided. ",
        model: "gpt-4o",
        tools: [{"type": "code_interpreter"}],
        tool_resources: {
        "code_interpreter": {
                "file_ids": [fileList[0].id]//[file.id]
            }
        }
    });

    // then create a thread (conversation)
    const thread = await openai.beta.threads.create();
    const message = await openai.beta.threads.messages.create(
        thread.id,
        {
          role: "user",
          content: "Please provide some interesting insights on the data within json file(s) provided. The EventLogs.json file contains a global array of user entries, each user has PlayFab id and some Event Logs and Account Data each in their own object. Using the Account Data tell me how many new vs returning users there are (a new user is a user who was create the account in this month, and a returning users who created an account outside of this month but has logged in within this month). Please also provide insights surrounding the events and general usage trends, where appropriate draw a graph to illustrate. The event insights should remark on the activities, topics and times of day and, days, weeks, months that are most interesting, for example; \"in the first week of Jan we can see that the topic with id [topic_id] is most popular as it was launched X times\", you'll get this data from the EventLogs object using the EventLogDate and checking for the \"launch_activity\" event. To gain more context and understanding of the app events the fully_filled_event_descriptions.json file lists all the event ids and their parameters with a description of what each event and their parameters mean."
        }
    );

    // run the thread
    const run = openai.beta.threads.runs.stream(thread.id, {
        assistant_id: assistant.id
      })
        .on('textCreated', (text) => console.log('\nassistant > '))
        .on('textDelta', (textDelta, snapshot) => console.log(textDelta.value))
        .on('toolCallCreated', (toolCall) => console.log(`\nassistant > ${toolCall.type}\n\n`))
        .on('toolCallDelta', (toolCallDelta, snapshot) => {
          if (toolCallDelta.type === 'code_interpreter') {
            if (toolCallDelta.code_interpreter.input) {
              console.log(toolCallDelta.code_interpreter.input);
            }
            if (toolCallDelta.code_interpreter.outputs) {
              console.log("\noutput >\n");
              toolCallDelta.code_interpreter.outputs.forEach(output => {
                if (output.type === "logs") {
                  console.log(`\n${output.logs}\n`);
                }
              });
            }
          }
        });
}

//generateAIInsights(["./insights/EventLogs.json"]);

module.exports = { aiInsightsRouter };