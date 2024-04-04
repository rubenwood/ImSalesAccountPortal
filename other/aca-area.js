const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const acaAreaRouter = express.Router();

const { getTotalRowCount } = require('../database/database');

acaAreaRouter.get('/gen-area-rep', async (req, res) => {
    console.log("called aca area search");
    try {
        let page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
        let pageSize = parseInt(req.query.pageSize) || 100; // Default page size
        let areas = req.query.areas.split(',');
        console.log(areas);

        // Convert areas to lowercase
        areas = areas.map(area => area.toLowerCase());
        const config = { headers: { 'x-secret-key': process.env.SERVER_SEC } };
        const chunkSize = 10000;
        let allPlayersWithAcademicArea = new Map(areas.map(id => [id, new Set()]));
        console.log("1 ", allPlayersWithAcademicArea);

        async function processChunk(startRow) {
            try {
                let url = `http://${process.env.SERVER_URL}:${process.env.PORT}/db/playerdata` +
                    `?start=${startRow}&end=${startRow + chunkSize - 1}`;
                const response = await axios.get(url, config);
                const respDataRows = response.data;

                let errorAmount = 0;

                for (const row of respDataRows) {
                    try {
                        let academicArea = row.PlayerDataJSON?.Data?.AcademicArea ?? undefined;
                        if (academicArea != undefined && academicArea.Value) {
                            let academicAreaString = academicArea.Value.toLowerCase();
                            if (academicAreaString != undefined && areas.includes(academicAreaString)) {
                                if (allPlayersWithAcademicArea.has(academicAreaString)) {
                                    allPlayersWithAcademicArea.get(academicAreaString).add(row);
                                } else {
                                    console.log(`Academic area not found in the initial list: ${academicAreaString}`);
                                }
                            }
                        }
                    } catch (error) {
                        errorAmount++;
                        console.error('Error processing player data:', error);
                    }
                }
                return { errorAmount };
            } catch (error) {
                console.error('Error processing chunk:', error.message);
                return { errorAmount: 1 };
            }
        }

        const totalRows = await getTotalRowCount();
        console.log(`total rows: ${totalRows}`);
        const totalChunks = Math.ceil(totalRows / chunkSize);
        console.log("chunks ", totalChunks);
        const chunkPromises = [];

        for (let i = 0; i < totalChunks; i++) {
            const startRow = i * chunkSize;
            chunkPromises.push(processChunk(startRow));
        }

        // Process all chunks concurrently
        console.log("processing....");
        await Promise.all(chunkPromises);

        // After processing all chunks and before compiling the final list
        let totalUsers = 0;
        allPlayersWithAcademicArea.forEach(players => {
            totalUsers += players.size; // Count total users across all areas
        });

        const startIndex = (page - 1) * pageSize;
        let remaining = pageSize; // Number of user entries to include in this page

        let outputList = [];
        allPlayersWithAcademicArea.forEach((players, areaId) => {
            if (remaining <= 0) return; // Skip adding more users if we've reached the page size

            let usersArray = Array.from(players).slice(0, remaining); // Take up to 'remaining' users
            remaining -= usersArray.length; // Decrease the 'remaining' count

            let output = {
                academicArea: areaId,
                users: usersArray
            };
            outputList.push(output);
        });

        // Note: This adjusted approach does not fully paginate across all academic areas consistently.
        // It will fill up to 'pageSize' users starting from the first academic area, 
        // and may not include users from later areas if 'pageSize' is reached.

        res.json({
            page,
            pageSize,
            total: totalUsers, // Reflects total users, but pagination logic might need further adjustment
            totalPages: Math.ceil(totalUsers / pageSize),
            data: outputList // Now limits the number of user entries based on pageSize
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

module.exports = { acaAreaRouter };