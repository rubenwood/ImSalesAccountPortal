// goxiyo8715@numerobo.com - 702A385C98CEF3BF
// goxiyo87@numerobo.com - 2D81A344E58264B6
let suffixBlackList = ["immersifyeducation.com", "immersify.com"];
let playfabIdBlackList = [
    "A086EDFA1AEDE31F",
    "75D9427BF3A6BE89",
    "1B86BD0E287108DF",
    "A9502B9483DA5D11",
    "4F9D757427ACC412",
    "3914A10453A4BFEE",
    "ECC58E8E76C9006F",
    "20EBF3A001067BAD",
    "857BDAF7D1C878EA",
    "82895AE7093B7EE4",
    "A088AC67938CDC2B",
    "968A857513B58BAA",
    "151016916A9CEE93",
    "A5082F250BFDDE8D",
    "393AA92B2C3B743D",
    "91F64AF76172D2D3",
    "342316A8F8191ED9",
    "3C529480FAE2A99C",
    "74EF179DE729AE05",
    "A56CA442B299F430",
    "6BDB3626365E6EB3",
    "E859DA30169EA261",
    "E3D6C9396CF81FDC",
    "14E02BEC5C04F7AB",
    "53ECB0EB8117BE18",
    "57B13D584183AA01",
    "8CC01C923F45D8A9",
    "1FF73EDEB610131D",
    "28DF85D1CEA8E805",
    "1BF2360B622FBF77",
    "4FFDE67259B68B1A",
    "E9A9C4B987BADDDF",
    "66F3A8173B32578E",
    "E027D4370FA6C3BF",
    "ACBE56C98E52AD0C",
    "B13D92E1858AF362",
    "6A50EBE34D85CD22",
    "23969B21377234B6",
    "7B20E6816F2B5E87",
    "6EB4C81FBA2478E6",
    "D121AB10B324E47",
    "50594E470AFFEFA4",
    "B987385A352522E1",
    "57A3FE729CFFCF29",
    "4940BD4CE94C5B44",
    "242852EC770E9803",
    "6B740B078F2EA181",
    "9BCFCB0F09665B00",
    "ED487DAA95B4402",
    "8DA7B6B9730BE6BC",
    "C733DDB3269F0793",
    "F2B5530E54451679",
    "FCC2170BAAAB3EA7",
    "1EFDF5D16DE18CA5",
    "FA71E015ECAAC9BB",
    "49BD4A871FCCFF08",
    "F0E84E00E0696CFD",
    "5846548B147730E3",
    "59B0753230A3C6AC",
    "464D835765B11C0",
    "256BACDD2B7C6710",
    "BF5E280095AFB0EB",
    "5932835E1B97C0DE",
    "FF301B35EF54D18B",
    "7E15B7262CD59E92",
    "95FAA8D7D9A0CE2F",
    "21EB0C424B5FF2FA",
    "739D0061941D4F30",
    "9CA1BD64D2758111",
    "E5321AD5428BDF0C",
    "652626E6EADB20D0",
    "A39D4619897D8FC5",
    "5B11560112C3560A",
    "67D05B1BFD6BDFE6",
    "355828EA8341FAA1",
    "440ECB3E34E216C3",
    "D699320D19CF72D1",
    "52B370CF922CF2FA",
    "118205DCCC438304",
    "C43AB15FD634D8F1",
    "48310D73C299529D",
    "A6A24BB176E386D1",
    "DE1D094DAA4EF0BA",
    "4E5D6779102BEC51",
    "2162965433B58324",
    "6AF6E0F8BD20D203",
    "702A385C98CEF3BF",
    "2D81A344E58264B6",
    "30CD1336ED97DE5A",
    "9766F05224A16AF9",
    "30CD1336ED97DE5A",
    "118205DCCC438304",
    "50594E470AFFEFA4",
    "1A658389625D0C74"
];


export function filterEventLogs(eventLogs){
    console.log(eventLogs);

    let filteredEventLogs = [];

    for(const eventLog of eventLogs){
        let linkedAccounts = eventLog.AccountDataJSON.LinkedAccounts;
        // select linked account where .Platform == "PlayFab"
        let playfabAccount = linkedAccounts.find(account => account.Platform == "PlayFab");
        if(playfabAccount != undefined && playfabAccount.Email != undefined && suffixBlackList.includes(playfabAccount.Email.split('@')[1])){
            continue;
        }
        
        if(playfabIdBlackList.includes(eventLog.playfabId)){
            continue;
        }

        // if we made it this far, user is not being filtered out
        filteredEventLogs.push(eventLog);
    }

    return filteredEventLogs;
}