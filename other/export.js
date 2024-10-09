const XLSX = require('xlsx');

// Adds arbitrary text to a worksheet
function addMessages(worksheet, messages) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const newRange = XLSX.utils.encode_range({ s: { c: range.s.c, r: 0 }, e: { c: range.e.c, r: range.e.r + messages.length } });

    // Shift all rows down by the number of messages
    for (let R = range.e.r; R >= range.s.r; --R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R + messages.length, c: C });
            const prevCellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (worksheet[prevCellRef]) {
                worksheet[cellRef] = worksheet[prevCellRef];
            } else {
                delete worksheet[cellRef];
            }
        }
    }

    // Insert the messages
    messages.forEach((message, index) => {
        const messageCellRef = XLSX.utils.encode_cell({ r: index, c: 0 });
        worksheet[messageCellRef] = { t: 's', v: message };
        // Clear the rest of the cells in the message row
        for (let C = range.s.c + 1; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: index, c: C });
            delete worksheet[cellRef];
        }
    });

    worksheet['!ref'] = newRange;
}
function removeSpecificHeaders(worksheet, columnsToRemove) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    columnsToRemove.forEach(column => {
        // Check if it's a column name (like 'Jan') or a specific cell (like 'A1')
        if (typeof column === 'string') {
            // If it's a specific cell like 'A1', remove that
            if (column.match(/^[A-Z]+\d+$/)) {
                if (worksheet[column]) {
                    delete worksheet[column];  // Delete specific cell content
                }
            } else {
                // If it's a column header (e.g., 'Jan', 'Feb'), find the corresponding cell in the first row
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });  // First row (r = 0)
                    if (worksheet[cellAddress] && worksheet[cellAddress].v === column) {
                        delete worksheet[cellAddress];  // Delete the header content
                    }
                }
            }
        }
    });
}

module.exports = { 
    addMessages,
    removeSpecificHeaders
}