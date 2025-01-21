import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, imAPIPost, getAreas, getModules, getTopics, getActivities, getTreeStructure, getTopicBrondons } from '../immersifyapi/immersify-api.js';

// ON PAGE LOAD
document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);

    await waitForJWT();

    // Button events
    document.getElementById('get-lesson-jsonl').addEventListener('click', getLessonJSONL);
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};


async function getLessonJSONL(){
    const TreeStructure = await getTreeStructure();
    console.log(TreeStructure);
    
    const areaBrondons = TreeStructure.inAreas;
    const moduleBrondons = getModulesFromAreas(areaBrondons);
    const topicBrondons = getTopicsFromModules(moduleBrondons);
    const floatingTopicBrondons = TreeStructure.inFloatingTopics;
    const allTopicsBrondons = [...topicBrondons, ...floatingTopicBrondons]
    const testTopicBrondons = TreeStructure.inTestTopics;
    const activityBrondons = getActivitiesFromTopics(topicBrondons);
    // need to get text data for each lesson too

    populateData(areaBrondons, "lesson");
}


function getModulesFromAreas(areas){
    let modules = [];
    areas.forEach(area => modules.push(...area.children));
    return modules;
}
function getTopicsFromModules(modules){
    let topics = [];
    modules.forEach(module => topics.push(...module.children));
    return topics;
}
function getActivitiesFromTopics(topics){
    let activities = [];
    topics.forEach(topic => activities.push(...topic.children));
    return activities;
}

async function populateData(areaBrondons, type){    
    for (const areaBrondon of areaBrondons) {
        for (const moduleBrondon of areaBrondon.children) {
            for (const topicBrondon of moduleBrondon.children) {    
                for (const activityBrondon of topicBrondon.children) {
                    if (activityBrondon.type === type) {
                        
                        let areaName;
                        let moduleName;
                        let topicName;                        
                        let activityName;

                        console.log(activityBrondon);
                        
                        const lessonSections = await imAPIGet(`lessons/${activityBrondon.structureId}/allData`);
                        console.log(lessonSections);
                        //processSubtitleText();
                        //formatAsChatMessages
                    }
                }
            }
        }
    }
}



function processSubtitleText(input) {
    const lines = input.split('\n');

    let result = '';
    let tempText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^\d+$/.test(line) || /-->/.test(line)) {
            continue;
        }

        if (line) {
            tempText += line.replace(/<br\/>/g, ' ');
        } else {
            if (tempText) {
                result += tempText.trim() + ' ';
                tempText = '';
            }
        }
    }

    // Add any remaining text to the result
    if (tempText) {
        result += tempText.trim();
    }

    return result.trim();
}
function formatAsChatMessages(text) {
    if(text.includes("Start Typing...")){
        return;
    }

    return {
        messages: [
            {
                role: "system",
                content: "You are a subject matter expert who writes content for lessons in an educational app. The app features 3D models and spoken narration of your text. Ensure your content is factually correct and adheres to educational standards."
            },
            {
                role: "user",
                // this will need the area, module, topic, lesson names
                content: "Write a lesson point for a lesson on [EXAMPLE]" // replace [EXAMPLE] with the point / lesson name?
            },
            {
                role: "assistant",
                content: text.trim()
            }
        ]
    };
}