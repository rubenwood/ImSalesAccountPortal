const express = require('express');
const axios = require('axios');
const oneSignalRouter = express.Router();

// pick random values
// random time
// random message?


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


const contentList = [
    "Don't forget to study often to succeed! Why not try a new lesson today?",
    "Complete at least 1 lesson a day to keep the dentist at bay!",
    "Log on and try some more activities!",
    "You'll love these new activities!",
    "Flashcards, Quizzes, 3D Models... We have it all!"
];
const headingList = [
    "Immersify your learning now!",
    "Learn immersivley with Immersify",
    "Immerse yourself in your studies",
    "Its time to Immerisfy!",
    "⏰ Uh Oh! It's cram time!"
];

oneSignalRouter.post('/send-push', async (req, res) => {
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.SERVER_SEC) {
        return res.status(401).json({ message: 'Invalid credential' });
    }
    
    const randomIndex = Math.floor(Math.random() * contentList.length);
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    //const oneHourLaterUTC = new Date(oneHourLater.toISOString());
    const oneHourLaterUTCString = oneHourLater.toISOString();

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
        send_after: oneHourLaterUTCString
    };

    const osResponse = SendPushNotification(data);
    const resp = { message:"sent", timestamp:oneHourLaterUTCString, osResponse }
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
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    //const oneHourLaterUTC = new Date(oneHourLater.toISOString());
    const oneHourLaterUTCString = oneHourLater.toISOString();

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
    const resp = { message:"sent", timestamp:oneHourLaterUTCString, osResponse }
    res.send(resp);
});

module.exports = { oneSignalRouter }