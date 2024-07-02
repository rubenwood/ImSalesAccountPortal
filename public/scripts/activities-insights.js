export function showActivitiesInsightsModal(reportData) {
    const modal = document.getElementById('insightsModal');
    const span = document.getElementsByClassName("close")[0];
    //document.getElementById('insightsContent').innerHTML = content;

    modal.style.display = "block";
    span.onclick = function() {
        modal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

}