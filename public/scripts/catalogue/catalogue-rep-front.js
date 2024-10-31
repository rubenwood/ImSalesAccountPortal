import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getAreas, getModules, getTopics, getActivities, getTreeStructure, getTopicBrondons } from '../immersifyapi/immersify-api.js';

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

async function getCatalogueReport(){
    document.getElementById('get-rep-btn').value = "Getting Report...";
    //const [areas, modules, topics, activities] = await Promise.all([getAreas(), getModules(), getTopics(), getActivities()]);
    //console.log("got all areas:\n", areas, "\nmodules:\n", modules, "\ntopics:\n" , topics, "\nactivities:\n", activities);

    const treeStructure = await getTreeStructure();
    console.log(treeStructure);
    const areaBrondons = treeStructure.inAreas;
    const moduleBrondons = getModulesFromAreas(areaBrondons);
    const topicBrondons = getTopicsFromModules(moduleBrondons);
    const floatingTopicBrondons = treeStructure.inFloatingTopics;
    const testTopicBrondons = treeStructure.inTestTopics;

    const activityBrondons = getActivitiesFromTopics(topicBrondons);
    console.log(activityBrondons);

    setAreaCount(areaBrondons);
    setModulesCount(moduleBrondons);
    setTopicsCount(topicBrondons, floatingTopicBrondons, testTopicBrondons);
    setActivities(activityBrondons);
    populateTotalsTable(areaBrondons);

    document.getElementById('get-rep-btn').value = "Get Report";
    
    doConfetti();
    renderForceDirectedTree(data);
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


function populateTotalsTable(areaStructure){
    const totalsTable = document.getElementById('totals-table');
    areaStructure.forEach(area => {
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

        let topicQuizzes = getTopicQuizzesFromActivities(activityBrondons);
        let quizCell = row.insertCell();
        quizCell.innerHTML = topicQuizzes.length;

        let flashcards = getFlashcardsFromActivities(activityBrondons);
        let flashcardCell = row.insertCell();
        flashcardCell.innerHTML = flashcards.length;

        let experiences = getExperiencesFromActivities(activityBrondons);
        let simsCell = row.insertCell();
        simsCell.innerHTML = experiences.length;
    });
}

// TEST DATA
const data = {
    Areas: [
        {
            AreaId: 123456,
            AreaName: "Dentistry",
            Modules: [
                {
                    ModuleId: "123345asd",
                    ModuleName: "Oral Anatomy & Biology",
                    Topics: [
                        {
                            TopicId: "123abcedf",
                            TopicName: "Tooth Morphology",
                            Activities: [
                                { ActivityId: "abcedasd123", ActivityType: "Simulation", ActivityName: "DentalId" },
                                { ActivityId: "nkjhyuay1212", ActivityType: "Lesson", ActivityName: "Maxillary Central Incisor" },
                                { ActivityId: "nkjh5551216", ActivityType: "Lesson", ActivityName: "Maxillary Lateral Incisor" },
                                { ActivityId: "nkjh55512188", ActivityType: "Lesson", ActivityName: "Maxillary Canine" },
                                { ActivityId: "nkjh5551210101", ActivityType: "Lesson", ActivityName: "Maxillary 1st Premolar" },
                                { ActivityId: "llolkokiasd123", ActivityType: "Lesson", ActivityName: "Maxillary 2nd Premolar" },
                                { ActivityId: "555asdasd987", ActivityType: "Lesson", ActivityName: "Maxillary 1st Molar" },
                            ]
                        }
                    ]
                },
                {
                    ModuleId: "ajskl111333",
                    ModuleName: "Endodontics",
                    Topics: [
                        {
                            TopicId: "ahdjdkj182",
                            TopicName: "Endo T1",
                            Activities: [
                                { ActivityId: "91823oklklklk", ActivityType: "Simulation", ActivityName: "Endo L1" },
                                { ActivityId: "lkjlkj", ActivityType: "Lesson", ActivityName: "Endo S1" }
                            ]
                        }
                    ]
                },
                {
                    ModuleId: "999897sad9sahsajkfh",
                    ModuleName: "Local Analgesia",
                    Topics: [
                        {
                            TopicId: "1932898hshdkljas",
                            TopicName: "Local Analgesia T1",
                            Activities: [
                                { ActivityId: "00009090dasdasd", ActivityType: "Simulation", ActivityName: "Local Analgesia L1" },
                                { ActivityId: "uioiiuop12i3po", ActivityType: "Lesson", ActivityName: "Local Analgesia S1" }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            AreaId: 789012,
            AreaName: "Nursing",
            Modules: [
                {
                    ModuleId: "456789xyz",
                    ModuleName: "Anatomy & Physiology",
                    Topics: [
                        {
                            TopicId: "456abcedg",
                            TopicName: "Bones",
                            Activities: [
                                { ActivityId: "a1b2c3d4", ActivityType: "Lesson", ActivityName: "Bone Care" },
                                { ActivityId: "e5f6g7h8", ActivityType: "Simulation", ActivityName: "Bone Health" }
                            ]
                        },
                        {
                            TopicId: "456abcedh",
                            TopicName: "Muscles",
                            Activities: [
                                { ActivityId: "i9j0k1l2", ActivityType: "Lesson", ActivityName: "Facial Muscles" }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};
      
function createZoomableSunburst(data) {
    // Specify the chart’s dimensions.
    const width = 928;
    const height = width;
    const radius = width / 6;    
    // Transform the input data into a hierarchical format
    const hierarchyData = {
        name: "Areas",
        children: data.Areas.map(area => ({
            name: area.AreaName,
            children: area.Modules.map(module => ({
                name: module.ModuleName,
                children: module.Topics.map(topic => ({
                    name: topic.TopicName,
                    children: topic.Activities.map(activity => ({
                        name: activity.ActivityName,
                        value: 1  // Assign a value of 1 to each activity for size
                    })),
                    value: topic.Activities.length  // Assign the number of activities to the topic
                })),
                value: module.Topics.reduce((sum, topic) => sum + topic.Activities.length, 0) // Total activities in the module
            })),
            value: area.Modules.reduce((sum, module) => sum + module.Topics.reduce((tSum, topic) => tSum + topic.Activities.length, 0), 0) // Total activities in the area
        }))
    };
    // Create the color scale.
    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, hierarchyData.children.length + 1));

    // Compute the layout.
    const hierarchy = d3.hierarchy(hierarchyData)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);
    const root = d3.partition()
        .size([2 * Math.PI, hierarchy.height + 1])
        (hierarchy);
    root.each(d => d.current = d);

    // Create the arc generator.
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    // Create the SVG container.
    const svg = d3.create("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, width])
        .style("font", "10px sans-serif");

    // Append the arcs.
    const path = svg.append("g")
        .selectAll("path")
        .data(root.descendants().slice(1))
        .join("path")
        .attr("class", "arc")
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
        .attr("d", d => arc(d.current));

    // Make them clickable if they have children.
    path.filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    const format = d3.format(",d");
    path.append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

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

    const parent = svg.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    // Immediately render all child nodes of the top level
    root.each(d => {
        if (d.depth === 1) {  // For top-level nodes
            d.target = {
                x0: d.x0,
                x1: d.x1,
                y0: d.y0,
                y1: d.y1
            };
        }
    });

    // Handle zoom on click.
    function clicked(event, p) {
        parent.datum(p.parent || root);

        root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = svg.transition().duration(750);

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

        label.filter(function(d) {
            return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
    d3.select("#graph-container").append(() => svg.node());
    //return svg.node();
}

function renderForceDirectedTree(data) {
    // Convert data to a hierarchical format
    const hierarchicalData = {
        name: "Root",
        children: data.Areas.map(area => ({
            name: area.AreaName,
            children: area.Modules.map(module => ({
                name: module.ModuleName,
                children: module.Topics.map(topic => ({
                    name: topic.TopicName,
                    children: topic.Activities.map(activity => ({
                        name: activity.ActivityName
                    }))
                }))
            }))
        }))
    };

    // Set dimensions for the graph
    const width = 960;
    const height = 600;

    const svg = d3.select("#platcon-graph-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("max-width", "100%")
        .style("height", "auto");

    // Create a group for content (for zoom and pan)
    const g = svg.append("g");

    // Set up zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Create hierarchy and nodes
    const root = d3.hierarchy(hierarchicalData);
    root.count(); // Calculates number of descendants for each node and stores it in node.value

    const nodes = root.descendants();
    const links = root.links(); // This will create links based on hierarchy

    // Simulation with forceLink to maintain hierarchical links
    const simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-100))
        .force("link", d3.forceLink(links).distance(100).id(d => d.data.name))
        .force("center", d3.forceCenter(width / 2, height / 2));

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
            .on("end", dragended));

    node.append("circle")
        .attr("r", d => Math.sqrt(d.value) * 5)  // Radius based on number of descendants
        .attr("fill", d => d.children ? "lightblue" : "lightgreen");

    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -13 : 13)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);

    // Update link and node positions on each tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    // Drag functions
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
