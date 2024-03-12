import { canAccess } from './access-check.js';
import { fetchPlayersBySuffixList } from './segments.js';

export async function generateReportByClickId() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    console.log("searching by click id");
    
    let output = await fetchPlayersBySuffixList(suffix);    
    
    for(const element of output){
        try {
            await delay(500); // delay for each fetch req
            let userData = await fetchUserData(element.PlayerId);
            console.log(userData.data.Data);
        }catch(error){

        }
    }
}