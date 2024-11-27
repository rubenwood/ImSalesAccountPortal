const express = require('express');
const axios = require('axios');
const oneSignalRouter = express.Router();

// schedule cron job for each weekday (at midnight?)

// real seg name:
// Active Subscriptions

async function SendPushNotification(data) {
    try {
        const response = await axios.post('https://api.onesignal.com/notifications', data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${process.env.ONESIGNAL_API_KEY}`
            }
        });
        console.log('Success:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        throw error;
    }
}


const headingList = [
    "☀ Don't forget to study today!", // 1
    "📑Time to get studying!", // 2
    "Immerse yourself in your studies",
    "Its time to Immerisfy!",
    "⏰ Uh Oh! It's cram time!"
];
const contentList = [
    "Use all your daily activities to get the most out of your learning", // 1
    "Hit your learning goal by the end of the day!", // 2
    "Log on and try some more activities!",
    "You'll love these new activities!",
    "Flashcards, Quizzes, 3D Models... We have it all!"
];


oneSignalRouter.post('/send-push', async (req, res) => {
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.SERVER_SEC) {
        return res.status(401).json({ message: 'Invalid credential' });
    }
    
    const randomIndex = Math.floor(Math.random() * contentList.length);
    const now = new Date();
    const oneMinuteLater = new Date(now.getTime() + 60 * 1000);
    const oneMinuteLaterUTCString = oneMinuteLater.toISOString();
    //const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    //const oneHourLaterUTCString = oneHourLater.toISOString();    

    const data = {
        target_channel: "push",
        included_segments: ["Test Users"],
        app_id: process.env.ONESIGNAL_APP_ID,
        contents: {
            en: contentList[randomIndex]
        },
        headings: {
            en: headingList[randomIndex]
        },
        delayed_option: "last-active",
        send_after: oneMinuteLaterUTCString
    };

    const osResponse = SendPushNotification(data);
    const resp = { message:"sent", timestamp:now, sendAfter:oneMinuteLaterUTCString, osResponse }
    res.send(resp);
});


// Send Push RN
oneSignalRouter.post('/send-push-now', async (req, res) => {
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.SERVER_SEC) {
        return res.status(401).json({ message: 'Invalid credential' });
    }

    const randomIndex = Math.floor(Math.random() * contentList.length);
    const now = new Date();

    const data = {
        target_channel: "push",
        included_segments: ["Test Users"],
        app_id: process.env.ONESIGNAL_APP_ID,
        contents: {
            en: contentList[randomIndex]
        },
        headings: {
            en: headingList[randomIndex]
        }
    };

    const osResponse = SendPushNotification(data);
    const resp = { message:"sent", timestamp:now, osResponse }
    res.send(resp);
});

module.exports = { oneSignalRouter }