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

    // Extract Info Button - Modified to search across all tabs if necessary
    extractBtn.addEventListener('click', async () => {
        // Find the Google Maps tab
        const tabs = await chrome.tabs.query({ url: "*://www.google.com/maps/*" });
        const mapTab = tabs.find(t => t.url.includes('/maps/place/'));

        if (!mapTab) {
            alert('Please ensure a Google Maps business profile is open in another tab.');
            return;
        }

        chrome.tabs.sendMessage(mapTab.id, { action: 'extractData' }, (response) => {
            if (response && response.data) {
                if (response.data.name) {
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
                    alert('Could not extract data. Ensure you are on a business profile page.');
                }
            } else {
                alert('No response from page. Try refreshing the Google Maps tab.');
            }
        });
    });

    // Enrich Button
    enrichBtn.addEventListener('click', async () => {
        if (currentData.length === 0) return;

        enrichBtn.disabled = true;
        enrichBtn.innerText = 'Enriching...';

        const lastItem = currentData[currentData.length - 1];

        if (!lastItem.website || lastItem.website === '-') {
            alert('No website found for the latest business.');
            enrichBtn.disabled = false;
            enrichBtn.innerText = 'Enrich from Website';
            return;
        }

        chrome.runtime.sendMessage({ action: 'enrichData', url: lastItem.website }, (response) => {
            enrichBtn.disabled = false;
            enrichBtn.innerText = 'Enrich from Website';

            if (response && response.success) {
                lastItem.emails = response.data.emails.join(', ');
                lastItem.webPhones = response.data.phones.join(', ');
                lastItem.facebook = response.data.socials.facebook.join(', ');
                lastItem.instagram = response.data.socials.instagram.join(', ');
                lastItem.twitter = response.data.socials.twitter.join(', ');
                lastItem.whatsapp = response.data.socials.whatsapp.join(', ');
                lastItem.telegram = response.data.socials.telegram.join(', ');

                saveData();
                updateTable();
                alert('Enrichment complete!');
            } else {
                alert('Enrichment failed: ' + (response.error || 'CORS or Timeout. Ensure host_permissions are active.'));
            }
        });
    });

    // Copy All Button (Optimized for Google Sheets)
    copyBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        const text = formatForSheets(currentData);
        copyToClipboard(text, copyBtn);
    });

    // Column Copy Buttons (Header)
    document.querySelectorAll('.copy-col-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const col = e.target.getAttribute('data-col');
            const colData = currentData.map(item => item[col] || '').join('\n');
            copyToClipboard(colData, e.target);
        });
    });

    // CSV Export
    csvBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        const csv = convertToCSV(currentData);
        downloadFile(csv, 'gmaps_export.csv', 'text/csv');
    });

    // XLSX Export
    xlsxBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        if (typeof XLSX === 'undefined') {
            alert('XLSX library not loaded.');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(currentData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Businesses");
        XLSX.writeFile(workbook, "gmaps_export.xlsx");
    });

    // Clear All
    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data?')) {
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
            const actualIndex = currentData.length - 1 - index;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <a href="${item.mapsUrl || '#'}" target="_blank">Profile</a> 
                    <button class="cell-copy-btn" data-value="${item.mapsUrl || ''}" title="Copy Link">📋</button>
                </td>
                <td>
                    ${item.name || '-'} 
                    <button class="cell-copy-btn" data-value="${item.name || ''}" title="Copy Name">📋</button>
                </td>
                <td>
                    ${item.category || '-'} 
                    <button class="cell-copy-btn" data-value="${item.category || ''}" title="Copy Category">📋</button>
                </td>
                <td>
                    ${item.address || '-'} 
                    <button class="cell-copy-btn" data-value="${item.address || ''}" title="Copy Address">📋</button>
                </td>
                <td>
                    ${item.phone || '-'} 
                    <button class="cell-copy-btn" data-value="${item.phone || ''}" title="Copy Phone">📋</button>
                </td>
                <td>
                    ${item.website ? '<a href="' + item.website + '" target="_blank">Link</a>' : '-'} 
                    <button class="cell-copy-btn" data-value="${item.website || ''}" title="Copy Website">📋</button>
                </td>
                <td>
                    ${item.rating || '-'} 
                    <button class="cell-copy-btn" data-value="${item.rating || ''}" title="Copy Rating">📋</button>
                </td>
                <td>
                    ${item.reviewCount || '-'} 
                    <button class="cell-copy-btn" data-value="${item.reviewCount || ''}" title="Copy Reviews">📋</button>
                </td>
                <td>
                    <span title="${item.hours || ''}">${item.hours ? item.hours.substring(0, 15) + '...' : '-'}</span>
                    <button class="cell-copy-btn" data-value="${item.hours || ''}" title="Copy Hours">📋</button>
                </td>
                <td>
                    <span title="${item.emails || ''}">${item.emails ? item.emails.substring(0, 15) + '...' : '-'}</span>
                    <button class="cell-copy-btn" data-value="${item.emails || ''}" title="Copy Emails">📋</button>
                </td>
                <td>
                    <span title="${item.webPhones || ''}">${item.webPhones ? item.webPhones.substring(0, 15) + '...' : '-'}</span>
                    <button class="cell-copy-btn" data-value="${item.webPhones || ''}" title="Copy Web Phone">📋</button>
                </td>
                <td>
                    <button class="cell-copy-btn" data-value="${item.facebook || ''}" title="Copy FB">📋</button>
                </td>
                <td>
                    <button class="cell-copy-btn" data-value="${item.instagram || ''}" title="Copy IG">📋</button>
                </td>
                <td>
                    <button class="cell-copy-btn" data-value="${item.twitter || ''}" title="Copy X">📋</button>
                </td>
                <td>
                    <button class="cell-copy-btn" data-value="${item.whatsapp || ''}" title="Copy WA">📋</button>
                </td>
                <td>
                    <button class="cell-copy-btn" data-value="${item.telegram || ''}" title="Copy TG">📋</button>
                </td>
                <td class="action-cell">
                    <button class="row-copy-btn" data-index="${actualIndex}" title="Copy Full Row for Sheets">📋 Row</button>
                    <button class="delete-btn" data-index="${actualIndex}" title="Delete Record">×</button>
                </td>
            `;
            resultsTableBody.appendChild(row);
        });

        // Event Listeners for dynamic buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                currentData.splice(idx, 1);
                saveData();
                updateTable();
            });
        });

        document.querySelectorAll('.cell-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.getAttribute('data-value');
                copyToClipboard(val, e.target);
            });
        });

        document.querySelectorAll('.row-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                const item = currentData[idx];
                const fields = [
                    item.mapsUrl, item.name, item.category, item.address, item.phone,
                    item.website, item.rating, item.reviewCount, item.hours,
                    item.emails, item.webPhones, item.facebook, item.instagram,
                    item.twitter, item.whatsapp, item.telegram
                ].map(val => String(val || '').replace(/\r?\n|\r/g, ' ').trim());
                copyToClipboard(fields.join('\t'), e.target);
            });
        });

        // Enable/Disable Enrich button
        enrichBtn.disabled = currentData.length === 0;
    }

    function formatForSheets(data) {
        const headers = 'Maps Link\tName\tCategory\tAddress\tPhone\tWebsite\tRating\tReviews\tHours\tEmails\tWeb Phone\tFB\tIG\tX\tWA\tTG\n';
        const rows = data.map(item => {
            const fields = [
                item.mapsUrl, item.name, item.category, item.address, item.phone,
                item.website, item.rating, item.reviewCount, item.hours,
                item.emails, item.webPhones, item.facebook, item.instagram,
                item.twitter, item.whatsapp, item.telegram
            ].map(val => String(val || '').replace(/\r?\n|\r/g, ' ').trim());
            return fields.join('\t');
        }).join('\n');
        return headers + rows;
    }

    function copyToClipboard(text, btn) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = btn.innerText;
            btn.innerText = '✅';
            setTimeout(() => btn.innerText = originalText, 1000);
        }).catch(err => {
            console.error('Copy failed', err);
        });
    }

    function convertToCSV(data) {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => {
            return Object.values(row).map(value => {
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
