import {canAccess} from './access-check.js';
import {Login} from './PlayFabManager.js';
import {formatTimeToHHMMSS,updateButtonText} from './utils.js';
import {showActivitiesInsightsModal} from './activities-insights.js';
import { initializeDarkMode } from './themes/dark-mode.js';


export async function fetchTopicReportByTitle(topicTitleList){
    const resp = await fetch(`/topics/get-users-by-topic-title?topics=${topicTitleList}`);
    const dbOutput = await resp.json();
    return dbOutput;
}