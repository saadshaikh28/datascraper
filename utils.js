/**
 * utils.js
 * 
 * Shared helper functions for data processing.
 */

// Placeholder for XLSX library if it's not present
if (typeof XLSX === 'undefined') {
    console.log('XLSX library not loaded. Export to XLSX will be disabled.');
}

// Function to format phone number for cells (no country code)
function formatForSheet(data) {
    // Add any specific formatting for Google Sheets if needed
    return data;
}
