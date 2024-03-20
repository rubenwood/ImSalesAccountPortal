document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('generateByActivityIdButton').addEventListener('click', fetchActivityReport);
});


async function fetchActivityReport(){
    console.log("working");

    let activityIdsText = document.getElementById("activityIDList").value;
    let activityIdsList = activityIdsText.split('\n').filter(Boolean);
    console.log(activityIdsList);
    const resp = await fetch(`/activities/get-activity-report-id?activities=${activityIdsList}`);
    let output = await resp.json();
    console.log(output);
}