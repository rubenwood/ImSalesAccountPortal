import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { formatTimeToHHMMSS } from '../utils.js';
import { fetchUsersTopicsInFeed } from '../userdata/user-data-utils.js';
import { waitForJWT, imAPIGet, imAPIPost, getAreas, getModules, getTopics, getActivities, getTreeStructure, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import {delay } from '../asyncTools.js';

// D3 for graphs :)
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

// ON PAGE LOAD
document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);

    // toggle buttons
    document.getElementById('toggle-totals-btn').addEventListener('click', ()=> toggleSection('totals-table'));
    document.getElementById('toggle-act-per-topic-btn').addEventListener('click', ()=> toggleSection('act-per-topic-table'));
    document.getElementById('toggle-time-est-btn').addEventListener('click', ()=> toggleSection('lesson-data-table'));
    document.getElementById('exp-toggle-time-est-btn').addEventListener('click', ()=> toggleSection('exp-lesson-data-table'));
    document.getElementById('toggle-topics-in-feed-btn').addEventListener('click', ()=> toggleSection('topic-usage-table'));

    // wait for login
    await waitForJWT();
    // Button events
    document.getElementById('get-rep-btn').addEventListener('click', getCatalogueReport);
    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

function toggleSection(elementId){
    const element = document.getElementById(elementId);
  
    if(element){
        element.style.display = (element.style.display === "none" || element.style.display === "") ? "block" : "none";
    }else{
        console.warn(`Element with ID "${elementId}" not found.`);
    }
}


// DATA
let TreeStructure;
let GeneralData = {
    totalAreas:0
}
let LessonData = {}

// POPULATION
async function getCatalogueReport(){
    document.getElementById('get-rep-btn').value = "Getting Report...";

    TreeStructure = await getTreeStructure();
    console.log(TreeStructure);
    
    const areaBrondons = TreeStructure.inAreas;
    const moduleBrondons = getModulesFromAreas(areaBrondons);
    const topicBrondons = getTopicsFromModules(moduleBrondons);
    const floatingTopicBrondons = TreeStructure.inFloatingTopics;
    const allTopicsBrondons = [...topicBrondons, ...floatingTopicBrondons]
    const testTopicBrondons = TreeStructure.inTestTopics;
    const activityBrondons = getActivitiesFromTopics(topicBrondons);
    setTopicsCount(topicBrondons, floatingTopicBrondons, testTopicBrondons);

    await setGeneralData(areaBrondons);
    
    const startDate = "2023-01-01";
    const endDate = "2025-01-01";
    const brondonData = [
        { type: "area", brondons: areaBrondons },
        { type: "module", brondons: moduleBrondons },
        { type: "topic", brondons: allTopicsBrondons },
        { type: "activity", brondons: activityBrondons }
    ];

    const brondonsByMonth = getBrondonsByMonth(startDate, endDate, brondonData);
    console.log(brondonsByMonth);
    populateBronondsMonthTable(brondonsByMonth);
    console.log(brondonsByMonth);    
    
    populateTotalsTable(areaBrondons);
    populateActPerTopicsTable(areaBrondons);
    populateLessonDataTable(areaBrondons);
    populateExperienceDataTable(areaBrondons);
    //await populateTopicUsageTable(topicBrondons);

    // need to store a snapshot of this data per month    

    document.getElementById('get-rep-btn').value = "Get Report";
    
    doConfetti();
    renderForceDirectedTree(TreeStructure.inAreas);
    //setHierarchyData(TreeStructure.inAreas);
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
function getLessonsFromActivities(activities){
    return activities.filter(activity => activity.type == 'lesson');
}
function getExperiencesFromActivities(activities){
    return activities.filter(activity => activity.type == 'experience');
}
function getTopicQuizzesFromActivities(activities){
    return activities.filter(activity => activity.type == 'topicquiz');
}
function getFlashcardsFromActivities(activities){
    return activities.filter(activity => activity.type == 'flashcarddeck');
}
async function getPointsFromLessons(lessons){
    // lesson id 4a494cd3-2d84-4351-8979-f39508ad6d07
    const ids = lessons.map(lesson => lesson.structureId);
    const chunkSize = 5;
    const staggerDelay = 250;

    let points = [];

    async function processChunk(chunk) {
        const chunkPromises = chunk.map(id =>
            imAPIPost(`lessons/${id}/allData`, { languageId: "english-us" })
        );
        const results = await Promise.all(chunkPromises);
        return results.map(res => JSON.parse(res).points);
    }

    // Process IDs in chunks
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const chunkPoints = await processChunk(chunk);
        points.push(...chunkPoints);
        await delay(staggerDelay);
    }

    return points;
}

function setTopicsCount(topics, floatingTopics, testTopics){
    let totalTopics = topics.length+floatingTopics.length+testTopics.length;
    document.getElementById('topics-count').innerHTML = `<b>Topics:</b><br/>
    Normal topics: ${topics.length}<br/>
    Floating topics: ${floatingTopics.length}<br/>
    Test topics: ${testTopics.length}<br/>
    Total: ${totalTopics}`;
}
async function setGeneralData(areaBrondons){
    GeneralData.PerAreaData = [];

    GeneralData.totalAreas = areaBrondons.length;
    GeneralData.totalModules = 0;
    GeneralData.totalTopics = 0;
    GeneralData.totalActivities = 0;
    GeneralData.totalLessons = 0;
    //GeneralData.totalSubheadings = 0;
    GeneralData.totalTopicQuizzes = 0;
    GeneralData.totalFlashcards = 0;
    GeneralData.totalExperiences = 0;

    for(const area of areaBrondons) {
        let moduleBrondons = area.children;
        let topicBrondons = getTopicsFromModules(moduleBrondons);
        let activityBrondons = getActivitiesFromTopics(topicBrondons);
        let lessons = getLessonsFromActivities(activityBrondons);
        let topicQuizzes = getTopicQuizzesFromActivities(activityBrondons);
        let flashcards = getFlashcardsFromActivities(activityBrondons);
        let experiences = getExperiencesFromActivities(activityBrondons);

        // let pointsPerLesson = await getPointsFromLessons(lessons);
        // const totalSubheadingsCount = pointsPerLesson.reduce((sum, item) => {
        //     return sum + (Array.isArray(item) ? item.length : 0);
        // }, 0);
        // console.log(totalSubheadingsCount);

        // Per Area Data
        let AreaData = {
            structureId:area.structureId,
            externalTitle:area.externalTitle,
            totalModules:moduleBrondons.length,
            totalTopics:topicBrondons.length,
            totalActivities:activityBrondons.length,
            totalLessons:lessons.length,
            //totalSubheadings:totalSubheadingsCount,
            totalTopicQuizzes:topicQuizzes.length,
            totalFlashcards:flashcards.length,
            totalExperiences:experiences.length
        }
        GeneralData.PerAreaData.push(AreaData);        
        
        // Overall Data
        GeneralData.totalModules += moduleBrondons.length;
        GeneralData.totalTopics += topicBrondons.length;
        GeneralData.totalActivities += activityBrondons.length;
        GeneralData.totalLessons += lessons.length;
        //GeneralData.totalSubheadings += totalSubheadingsCount;
        GeneralData.totalTopicQuizzes += topicQuizzes.length;
        GeneralData.totalFlashcards += flashcards.length;
        GeneralData.totalExperiences += experiences.length;
    }
}

// Content created within time frame
function getCreatedWithin(startDate, endDate, brondons, type) {
    let brondonsCreatedWithin = [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let brondon of brondons) {
        const createdDate = new Date(brondon.createdat);
        if (createdDate >= start && createdDate <= end) {
            brondonsCreatedWithin.push(brondon);
        }
    }

    const output = {
        type, // type of brondons; area, module, topic, activity
        startDate,
        endDate,
        brondonsCreatedWithin
    };

    return output;
}
function getBrondonsByMonth(startDate, endDate, brondonData) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let results = [];
    let current = new Date(start);

    while (current < end) {
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

        let monthlyData = {
            month: monthStart.toLocaleDateString('en-UK', { year: 'numeric', month: '2-digit' }).replace(/\//g, '-')
        };

        for (let { type, brondons } of brondonData) {
            const result = getCreatedWithin(
                monthStart.toISOString(),
                monthEnd.toISOString(),
                brondons,
                type
            );
            monthlyData[type] = {
                count: result.brondonsCreatedWithin.length,
                brondons: result.brondonsCreatedWithin
            };
        }

        results.push(monthlyData);

        // Increment to next month more explicitly
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return results;
}

// TABLES
async function populateTotalsTable(areaStructure){
    const totalsTable = document.getElementById('totals-table');

    for(const areaData of GeneralData.PerAreaData) {
        let row = totalsTable.insertRow();
        row.insertCell();

        let areaCell = row.insertCell();
        areaCell.innerHTML = areaData.externalTitle;

        let modulesCell = row.insertCell();
        modulesCell.innerHTML = areaData.totalModules;

        let topicsCell = row.insertCell();
        topicsCell.innerHTML = areaData.totalTopics;

        let activityCell = row.insertCell();
        activityCell.innerHTML = areaData.totalActivities;

        let lessonCell = row.insertCell();
        lessonCell.innerHTML = areaData.totalLessons;

        let subheadingsCell = row.insertCell();
        subheadingsCell.innerHTML = areaData.totalSubheadings;

        let quizCell = row.insertCell();
        quizCell.innerHTML = areaData.totalTopicQuizzes

        let flashcardCell = row.insertCell();
        flashcardCell.innerHTML = areaData.totalFlashcards;

        let simsCell = row.insertCell();
        simsCell.innerHTML = areaData.totalExperiences;
    }

    console.log(areaStructure);
    console.log(GeneralData);

    // spacing row
    let emptyRow = totalsTable.insertRow();
    let spacingCell = emptyRow.insertCell();
    spacingCell.innerHTML = `-----------`;

    let totalRow = totalsTable.insertRow();
    let totalCell = totalRow.insertCell();
    totalCell.innerHTML = '<b>TOTALS</b>';    

    let totalAreasCell = totalRow.insertCell();
    totalAreasCell.innerHTML = GeneralData.totalAreas;

    let totalModulesCell = totalRow.insertCell();
    totalModulesCell.innerHTML = GeneralData.totalModules;

    let totalTopicsCell = totalRow.insertCell();
    totalTopicsCell.innerHTML = GeneralData.totalTopics;

    let totalActivitiesCell = totalRow.insertCell();
    totalActivitiesCell.innerHTML = GeneralData.totalActivities;

    let totalLessonsCell = totalRow.insertCell();
    totalLessonsCell.innerHTML = GeneralData.totalLessons;

    let totalSubheadingsCell = totalRow.insertCell();
    totalSubheadingsCell.innerHTML = GeneralData.totalSubheadings;

    let totalTopicQuizzesCell = totalRow.insertCell();
    totalTopicQuizzesCell.innerHTML = GeneralData.totalTopicQuizzes;

    let totalFlashcardsCell = totalRow.insertCell();
    totalFlashcardsCell.innerHTML = GeneralData.totalFlashcards;

    let totalExperiencesCell = totalRow.insertCell();
    totalExperiencesCell.innerHTML = GeneralData.totalExperiences;
}
async function populateActPerTopicsTable(areaBrondons){
    const actPerTopicTable = document.getElementById('act-per-topic-table');
    for(const areaBrondon of areaBrondons){        

        for(const moduleBrondon of areaBrondon.children){
            for(const topicBrondon of moduleBrondon.children){
                let dataRow = actPerTopicTable.insertRow();        
                let areaCell = dataRow.insertCell();
                areaCell.innerHTML = areaBrondon.externalTitle;

                let moduleCell = dataRow.insertCell();
                moduleCell.innerHTML = moduleBrondon.externalTitle;

                let topicCell = dataRow.insertCell();
                topicCell.innerHTML = topicBrondon.externalTitle;

                let activitiesCell = dataRow.insertCell();
                activitiesCell.innerHTML = topicBrondon.children.length;
            }
        }
    }
}
function populateTimeEstTable(areaBrondons, tableElement, type){
    for (const areaBrondon of areaBrondons) {
        for (const moduleBrondon of areaBrondon.children) {

            let moduleTotalTime = 0;
            for (const topicBrondon of moduleBrondon.children) {
                moduleTotalTime += calcTotalTimeEst(topicBrondon.children, type);
            }

            for (const topicBrondon of moduleBrondon.children) {                
                let topicTotalTime = 0;
                topicTotalTime += calcTotalTimeEst(topicBrondon.children, type);

                for (const activityBrondon of topicBrondon.children) {
                    if (activityBrondon.type === type) {
                        let dataRow = tableElement.insertRow();
                        
                        let areaCell = dataRow.insertCell();
                        areaCell.innerHTML = areaBrondon.externalTitle;

                        let moduleCell = dataRow.insertCell();
                        moduleCell.innerHTML = moduleBrondon.externalTitle;
                        let moduleTimeEstCell = dataRow.insertCell();
                        moduleTimeEstCell.innerHTML = formatTimeToHHMMSS(moduleTotalTime);

                        let topicCell = dataRow.insertCell();
                        topicCell.innerHTML = topicBrondon.externalTitle;

                        let topicTimeEstCell = dataRow.insertCell();
                        topicTimeEstCell.innerHTML = formatTimeToHHMMSS(topicTotalTime);

                        let lessonTitleCell = dataRow.insertCell();
                        lessonTitleCell.innerHTML = activityBrondon.externalTitle;

                        let lessonTimeEstCell = dataRow.insertCell();
                        lessonTimeEstCell.innerHTML = formatTimeToHHMMSS(activityBrondon.timeEstimate);
                    }
                }
            }
        }
    }
}
function calcTotalTimeEst(activities, type){
    let totalTime = 0;
    for (const activityBrondon of activities) {
        if (activityBrondon.type === type) {
            totalTime += Number(activityBrondon.timeEstimate);
        }
    }
    return totalTime;
}
function populateLessonDataTable(areaBrondons) {
    populateTimeEstTable(areaBrondons, document.getElementById('lesson-data-table'), "lesson");
    
}
function populateExperienceDataTable(areaBrondons) {
    populateTimeEstTable(areaBrondons, document.getElementById('exp-lesson-data-table'), "experience");
}
function populateBronondsMonthTable(data){
    let html = `
        <table border="1" style="border-collapse: collapse; width: 100%;">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Areas</th>
                    <th>Modules</th>
                    <th>Topics</th>
                    <th>Activities</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Initialize running totals
    let runningTotals = {
        area: 0,
        module: 0,
        topic: 0,
        activity: 0
    };

    // Populate table rows with data
    for (let entry of data) {
        // Update running totals
        const areaCount = entry.area ? entry.area.count : 0;
        const moduleCount = entry.module ? entry.module.count : 0;
        const topicCount = entry.topic ? entry.topic.count : 0;
        const activityCount = entry.activity ? entry.activity.count : 0;

        runningTotals.area += areaCount;
        runningTotals.module += moduleCount;
        runningTotals.topic += topicCount;
        runningTotals.activity += activityCount;

        // Add row to the table
        html += `
            <tr>
                <td>${entry.month}</td>
                <td>${runningTotals.area} (+${areaCount})</td>
                <td>${runningTotals.module} (+${moduleCount})</td>
                <td>${runningTotals.topic} (+${topicCount})</td>
                <td>${runningTotals.activity} (+${activityCount})</td>
            </tr>
        `;
    }

    // Close the table structure
    html += `
            </tbody>
        </table>
    `;

    document.getElementById('totals-table-pm').innerHTML = html;
    return html;
}

async function populateTopicUsageTable(topicBrondons) {
    const topicIds = topicBrondons.map(brondon => brondon.structureId);
    const usersTopicsInFeed = await fetchUsersTopicsInFeed(topicIds);
    usersTopicsInFeed.sort((a, b) => b.users.length - a.users.length);

    const userCounts = {};
    usersTopicsInFeed.forEach(topicData => {
        topicData.users.forEach(user => {
            userCounts[user] = (userCounts[user] || 0) + 1;
        });
    });

    const uniqueUsers = [];
    usersTopicsInFeed.forEach(topicData => {
        topicData.users.forEach(user => {
            if (userCounts[user] === 1 && !uniqueUsers.includes(user)) {
                uniqueUsers.push(user);
            }
        });
    });
    console.log(uniqueUsers);
    document.getElementById('unique-users-feed').innerHTML = `Total Unique Users with topic(s) in feed: ${uniqueUsers.length}`;

    // Populate the table with the sorted data
    const topicUsageTable = document.getElementById('topic-usage-table');
    for (const topicData of usersTopicsInFeed) {
        const brondon = topicBrondons.find(brondon => brondon.structureId === topicData.topicId);

        let row = topicUsageTable.insertRow();

        let areaFlagCell = row.insertCell();
        areaFlagCell.innerHTML = brondon ? brondon.areaFlag : 'Unknown Area';

        let topicIdCell = row.insertCell();
        topicIdCell.innerHTML = topicData.topicId;

        let topicNameCell = row.insertCell();
        topicNameCell.innerHTML = brondon ? brondon.externalTitle : 'Unknown Topic';

        let numUsersCell = row.insertCell();
        numUsersCell.innerHTML = topicData.users.length;
    }
}


function renderZoomableSunburst(data) {
    // Transform data into a hierarchical structure for D3
    const hierarchyData = {
        name: "Root",
        children: data.map(area => ({
            name: area.externalTitle || "Unnamed Area",
            children: area.children.map(module => ({
                name: module.externalTitle || "Unnamed Module",
                children: module.children.map(topic => ({
                    name: topic.externalTitle || "Unnamed Topic",
                    children: topic.children.map(activity => ({
                        name: activity.externalTitle || "Unnamed Activity",
                        value: 1
                    }))
                }))
            }))
        }))
    };

    // Set up chart dimensions
    const width = 1000;
    const height = width;
    const radius = width / 6;

    // Create the color scale for each level in the hierarchy
    const colorByDepth = d3.scaleOrdinal()
        .domain([1, 2, 3, 4])
        .range(["#ADD8E6", "#00008B", "#800080", "#008000"]);

    // Compute the layout
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.value || 1)
        .sort((a, b) => b.value - a.value);

    d3.partition().size([2 * Math.PI, root.height + 1])(root);

    // Set each node's current position
    root.each(d => d.current = d);

    // Set up the SVG container
    const svg = d3.select("#platcon-graph-container")
        .append("svg")
        .attr("viewBox", [-width / 2, -width / 2, width, width])
        .style("font", "10px sans-serif");

    // Create an arc generator
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    // Append arcs for each node
    const path = svg.append("g")
        .selectAll("path")
        .data(root.descendants().slice(1))
        .join("path")
        .attr("fill", d => colorByDepth(d.depth)) // Color based on depth
        .attr("fill-opacity", d => d.children ? 0.6 : 0.4)
        .attr("pointer-events", d => d.children ? "auto" : "none")
        .attr("d", d => arc(d.current));

    // Make nodes clickable if they have children
    path.filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    path.append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join(" > ")}\n${d.value}`);

    // Add labels to the arcs
    const label = svg.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
        .selectAll("text")
        .data(root.descendants().slice(1))
        .join("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .text(d => d.data.name);

    // Circle in the center for zoom-out functionality
    const parent = svg.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    // Click event handler for zooming
    function clicked(event, p) {
        parent.datum(p.parent || root);

        root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = svg.transition().duration(750);

        // Transition for arcs
        path.transition(t)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function(d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
            .attrTween("d", d => () => arc(d.current));

        // Transition for labels
        label.filter(function(d) {
                return +this.getAttribute("fill-opacity") || labelVisible(d.target);
            }).transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    // Visibility functions for arcs and labels
    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    // Label transform for proper positioning
    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
}

// CONTENT MAP
function renderForceDirectedTree(data) {
    // Transform the flat structure into a hierarchical format for D3
    const hierarchyData = {
        name: "Root",
        children: data.map(area => ({
            name: area.externalTitle || "Unnamed Area",
            children: area.children.map(module => ({
                name: module.externalTitle || "Unnamed Module",
                children: module.children.map(topic => ({
                    name: topic.externalTitle || "Unnamed Topic",
                    children: topic.children.map(activity => ({
                        name: activity.externalTitle || "Unnamed Activity",
                        value: 1
                    })),
                    value: topic.children.length
                })),
                value: module.children.reduce((sum, topic) => sum + topic.children.length, 0)
            })),
            value: area.children.reduce((sum, module) => sum + module.children.reduce((tSum, topic) => tSum + topic.children.length, 0), 0)
        }))
    };

    // Set dimensions and create SVG container
    const width = 1800;
    const height = 1024;
    const svg = d3.select("#platcon-graph-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("max-width", "100%")
        .style("height", "auto");

    const g = svg.append("g");

    // Set up zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    // Create hierarchy and nodes
    const root = d3.hierarchy(hierarchyData);
    root.count();

    const nodes = root.descendants();
    const links = root.links();

    // Simulation with forces tailored for top-level node spacing
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance(d => d.source.depth === 1 ? 300 : 100 + d.source.depth * 50)
            .strength(1))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => 10 + Math.sqrt(d.value) * 5))
        .force("radial", d3.forceRadial(300, width / 2, height / 2).strength(d => d.depth === 1 ? 0.8 : 0));

    // Define color scale by depth
    const colorByDepth = d3.scaleOrdinal()
        .domain([1, 2, 3, 4])
        .range(["#ADD8E6", "#00008B", "#800080", "#008000"]);

    // Draw links (lines)
    const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1.5);

    // Draw nodes
    const node = g.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", (event, d) => zoomToNode(d));  // Add click event to pan to node

    node.append("circle")
        .attr("r", d => 5 + Math.sqrt(d.value) * 3)
        .attr("fill", d => colorByDepth(d.depth));

    function calcTextSize(d){
        let size = 10 * (Math.sqrt(d.value));
        console.log(size)
        return size;
    }
    //Math.min(Math.max(calcTextSize(d), 36), 74)

    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -15 - Math.sqrt(d.value) * 3 : 15 + Math.sqrt(d.value) * 3)
        .style("text-anchor", d => d.children ? "end" : "start")
        .style("font-size", d => `${14 + (Math.sqrt(d.value))}px`)
        .text(d => d.data.name);

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    function zoomToNode(d) {
        // Calculate the translate coordinates to center the clicked node
        const scale = 1;  // You can adjust this for additional zoom if desired
        const translateX = width / 2 - d.x * scale;
        const translateY = height / 2 - d.y * scale;

        // Apply the zoom transform with a smooth transition
        svg.transition()
            .duration(750)
            .call(
                zoom.transform,
                d3.zoomIdentity.translate(translateX, translateY).scale(scale)
            );
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}
