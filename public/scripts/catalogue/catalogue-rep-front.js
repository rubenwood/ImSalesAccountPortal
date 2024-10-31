import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, imAPIPost, getAreas, getModules, getTopics, getActivities, getTreeStructure, getTopicBrondons } from '../immersifyapi/immersify-api.js';

// D3 for graphs :)
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);
    // wait for login
    await waitForJWT();
    // Button events
    document.getElementById('get-rep-btn').addEventListener('click', getCatalogueReport);
    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

let TreeStructure;
async function getCatalogueReport(){
    document.getElementById('get-rep-btn').value = "Getting Report...";
    //const [areas, modules, topics, activities] = await Promise.all([getAreas(), getModules(), getTopics(), getActivities()]);
    //console.log("got all areas:\n", areas, "\nmodules:\n", modules, "\ntopics:\n" , topics, "\nactivities:\n", activities);

    TreeStructure = await getTreeStructure();
    console.log(TreeStructure);
    const areaBrondons = TreeStructure.inAreas;
    const moduleBrondons = getModulesFromAreas(areaBrondons);
    const topicBrondons = getTopicsFromModules(moduleBrondons);
    const floatingTopicBrondons = TreeStructure.inFloatingTopics;
    const testTopicBrondons = TreeStructure.inTestTopics;

    const activityBrondons = getActivitiesFromTopics(topicBrondons);
    console.log(activityBrondons);

    setAreaCount(areaBrondons);
    setModulesCount(moduleBrondons);
    setTopicsCount(topicBrondons, floatingTopicBrondons, testTopicBrondons);
    setActivities(activityBrondons);
    populateTotalsTable(areaBrondons);

    // need to store a snapshot of this data per month
    

    document.getElementById('get-rep-btn').value = "Get Report";
    
    doConfetti();
    renderForceDirectedTree(TreeStructure.inAreas);
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
    let ids = lessons.map(lesson => lesson.structureId);
    let lessonDataReqs = [];
    ids.forEach(id => lessonDataReqs.push(imAPIPost(`lessons/${id}/allData`, { languageId:"english-us" })) );
    const lessonDataRes = await Promise.all(lessonDataReqs);
    let lessonJSONs = [];
    lessonDataRes.forEach(res => lessonJSONs.push(JSON.parse(res)));

    let points = [];
    lessonJSONs.forEach(lesson => { if(lesson.points!=undefined && lesson.points.length>0){ console.log(lesson.points); } });
    return points;
}

function setAreaCount(areas){
    document.getElementById('areas-count').innerHTML = `<b>Areas:</b>${areas.length}`;
}
function setModulesCount(modules){
    document.getElementById('modules-count').innerHTML = `<b>Modules:</b>${modules.length}`;
}
function setTopicsCount(topics, floatingTopics, testTopics){
    let totalTopics = topics.length+floatingTopics.length+testTopics.length;
    document.getElementById('topics-count').innerHTML = `<b>Topics:</b><br/>
    Normal topics: ${topics.length}<br/>
    Floating topics: ${floatingTopics.length}<br/>
    Test topics: ${testTopics.length}<br/>
    Total: ${totalTopics}`;
}
function setActivities(activities){
    document.getElementById('activities-count').innerHTML = `<b>Activities:</b>${activities.length}`;
}

async function populateTotalsTable(areaStructure){
    const totalsTable = document.getElementById('totals-table');
    for(const area of areaStructure) {
        let row = totalsTable.insertRow();

        let areaCell = row.insertCell();
        areaCell.innerHTML = area.externalTitle;

        let moduleBrondons = area.children;
        let modulesCell = row.insertCell();
        modulesCell.innerHTML = moduleBrondons.length;

        let topicBrondons = getTopicsFromModules(moduleBrondons);
        let topicsCell = row.insertCell();
        topicsCell.innerHTML = topicBrondons.length;

        let activityBrondons = getActivitiesFromTopics(topicBrondons);
        let activityCell = row.insertCell();
        activityCell.innerHTML = activityBrondons.length;

        let lessons = getLessonsFromActivities(activityBrondons);
        let lessonCell = row.insertCell();
        lessonCell.innerHTML = lessons.length;

        let points = await getPointsFromLessons(lessons);
        console.log(points);

        let subheadingsCell = row.insertCell();
        subheadingsCell.innerHTML = 0;

        let topicQuizzes = getTopicQuizzesFromActivities(activityBrondons);
        let quizCell = row.insertCell();
        quizCell.innerHTML = topicQuizzes.length;

        let flashcards = getFlashcardsFromActivities(activityBrondons);
        let flashcardCell = row.insertCell();
        flashcardCell.innerHTML = flashcards.length;

        let experiences = getExperiencesFromActivities(activityBrondons);
        let simsCell = row.insertCell();
        simsCell.innerHTML = experiences.length;
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

    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -15 - Math.sqrt(d.value) * 3 : 15 + Math.sqrt(d.value) * 3)
        .style("text-anchor", d => d.children ? "end" : "start")
        .style("font-size", d => `${10 + Math.sqrt(d.value)}px`)
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
