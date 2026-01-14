/**
 * popup.js
 * 
 * Logic to handle UI events, communicate with content script,
 * and manage local storage.
 */

document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extractBtn');
    const enrichBtn = document.getElementById('enrichBtn');
    const copyBtn = document.getElementById('copyBtn');
    const csvBtn = document.getElementById('csvBtn');
    const xlsxBtn = document.getElementById('xlsxBtn');
    const clearBtn = document.getElementById('clearBtn');
    const recordCountEl = document.getElementById('recordCount');
    const resultsTableBody = document.querySelector('#resultsTable tbody');

    let currentData = [];

    // Load existing data from storage
    chrome.storage.local.get(['businessData'], (result) => {
        if (result.businessData) {
            currentData = result.businessData;
            updateTable();
        }
    });

    // Extract Info Button
    extractBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('google.com/maps')) {
            alert('Please open a Google Maps business profile page first.');
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'extractData' }, (response) => {
            if (response && response.data) {
                // Only add if it's a valid extraction (has a name at least)
                if (response.data.name) {
                    // Check for duplicates (based on name and address)
                    const isDuplicate = currentData.some(item =>
                        item.name === response.data.name && item.address === response.data.address
                    );

                    if (!isDuplicate) {
                        currentData.push(response.data);
                        saveData();
                        updateTable();
                    } else {
                        alert('This business is already in your list.');
                    }
                } else {
                    alert('Could not extract data. Make sure you are viewing a business profile.');
                }
            }
        });
    });

    // Enrich Button
    enrichBtn.addEventListener('click', async () => {
        if (currentData.length === 0) return;

        enrichBtn.disabled = true;
        enrichBtn.innerText = 'Enriching...';

        const lastItem = currentData[currentData.length - 1]; // Enrich the most recent one for simplicity

        if (!lastItem.website || lastItem.website === '-') {
            alert('No website found for this business.');
            enrichBtn.disabled = false;
            enrichBtn.innerText = 'Enrich from Website';
            return;
        }

        chrome.runtime.sendMessage({ action: 'enrichData', url: lastItem.website }, (response) => {
            enrichBtn.disabled = false;
            enrichBtn.innerText = 'Enrich from Website';

            if (response && response.success) {
                lastItem.emails = response.data.emails.join(', ');
                lastItem.socials = response.data.socials; // Save the object

                saveData();
                alert('Enrichment complete! Added emails and social links.');
                updateTable();
            } else {
                alert('Enrichment failed: ' + (response.error || 'Check console'));
            }
        });
    });

    // Copy All Button (Optimized for Google Sheets)
    copyBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;

        let tableText = 'Name\tCategory\tAddress\tPhone\tWebsite\tRating\tReviews\tHours\n';
        currentData.forEach(item => {
            tableText += `${item.name}\t${item.category}\t${item.address}\t${item.phone}\t${item.website}\t${item.rating}\t${item.reviewCount}\t${item.hours}\n`;
        });

        navigator.clipboard.writeText(tableText).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = originalText, 2000);
        });
    });

    // CSV Export
    csvBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        const csv = convertToCSV(currentData);
        downloadFile(csv, 'gmaps_export.csv', 'text/csv');
    });

    // XLSX Export (Requires library)
    xlsxBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        if (typeof XLSX === 'undefined') {
            alert('XLSX library not loaded. Please ensure libs/xlsx.full.min.js is present.');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(currentData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Businesses");
        XLSX.writeFile(workbook, "gmaps_export.xlsx");
    });

    // Clear All
    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all extracted data?')) {
            currentData = [];
            saveData();
            updateTable();
        }
    });

    function saveData() {
        chrome.storage.local.set({ businessData: currentData });
    }

    function updateTable() {
        recordCountEl.innerText = currentData.length;
        resultsTableBody.innerHTML = '';

        currentData.slice().reverse().forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.phone || '-'}</td>
        <td>${item.website ? '<a href="' + item.website + '" target="_blank">Link</a>' : '-'}</td>
        <td><button class="delete-btn" data-index="${currentData.length - 1 - index}">×</button></td>
      `;
            resultsTableBody.appendChild(row);
        });

        // Add delete functionality
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                currentData.splice(idx, 1);
                saveData();
                updateTable();
            });
        });

        // Enable/Disable Enrich button
        enrichBtn.disabled = currentData.length === 0;
    }

    function convertToCSV(data) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => {
            return Object.values(row).map(value => {
                // Escape quotes and wrap in quotes
                const str = String(value).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',');
        });
        return [headers, ...rows].join('\n');
    }

    function downloadFile(content, fileName, contentType) {
        const a = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }
});
