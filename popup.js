/**
 * popup.js
 */

document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extractBtn');
    const extractEnrichBtn = document.getElementById('extractEnrichBtn');
    const enrichBtn = document.getElementById('enrichBtn');
    const copyBtn = document.getElementById('copyBtn');
    const csvBtn = document.getElementById('csvBtn');
    const xlsxBtn = document.getElementById('xlsxBtn');
    const clearBtn = document.getElementById('clearBtn');
    const recordCountEl = document.getElementById('recordCount');
    const tableHeader = document.querySelector('#resultsTable thead tr');
    const resultsTableBody = document.querySelector('#resultsTable tbody');

    let currentData = [];

    // Initial Column Configuration
    let columnOrder = [
        { id: 'mapsUrl', label: 'Maps Link' },
        { id: 'placeId', label: 'Place ID' },
        { id: 'name', label: 'Name' },
        { id: 'category', label: 'Category' },
        { id: 'address', label: 'Address' },
        { id: 'phone', label: 'Phone' },
        { id: 'website', label: 'Website' },
        { id: 'rating', label: 'Rating' },
        { id: 'reviewCount', label: 'Reviews' },
        { id: 'hours', label: 'Hours' },
        { id: 'emails', label: 'Emails' },
        { id: 'webPhones', label: 'Web Phone' },
        { id: 'facebook', label: 'FB' },
        { id: 'instagram', label: 'IG' },
        { id: 'twitter', label: 'X' },
        { id: 'whatsapp', label: 'WA' },
        { id: 'telegram', label: 'TG' }
    ];

    // Drag and Drop state
    let draggedColumnId = null;

    // Load existing data and column order from storage
    chrome.storage.local.get(['businessData', 'columnOrder'], (result) => {
        if (result.businessData) {
            currentData = result.businessData;
        }
        if (result.columnOrder) {
            const savedOrder = result.columnOrder;
            const newOrder = [];
            savedOrder.forEach(id => {
                const col = columnOrder.find(c => c.id === id);
                if (col) newOrder.push(col);
            });
            columnOrder.forEach(col => {
                if (!newOrder.find(c => c.id === col.id)) newOrder.push(col);
            });
            columnOrder = newOrder;
        }
        updateTable();
    });

    // Helper: Find Google Maps Tab
    async function getMapsTab() {
        const tabs = await chrome.tabs.query({ url: "*://www.google.com/maps/*" });
        return tabs.find(t => t.url.includes('/maps/place/'));
    }

    // Extraction Logic
    async function performExtraction(silent = false) {
        const mapTab = await getMapsTab();
        if (!mapTab) {
            if (!silent) alert('Please ensure a Google Maps business profile is open in another tab.');
            return null;
        }

        return new Promise((resolve) => {
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
                            resolve(response.data);
                        } else {
                            if (!silent) alert('This business is already in your list.');
                            resolve(null);
                        }
                    } else {
                        if (!silent) alert('Could not extract data. Ensure you are on a business profile page.');
                        resolve(null);
                    }
                } else {
                    if (!silent) alert('No response from page. Try refreshing the Google Maps tab.');
                    resolve(null);
                }
            });
        });
    }

    // Enrichment Logic
    async function performEnrichment(item, silent = false) {
        if (!item || !item.website || item.website === '-') {
            if (!silent) alert('No website found to enrich.');
            return;
        }

        if (!silent) {
            enrichBtn.disabled = true;
            enrichBtn.innerText = 'Enriching...';
        }

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'enrichData', url: item.website }, (response) => {
                if (!silent) {
                    enrichBtn.disabled = false;
                    enrichBtn.innerText = 'Enrich Latest';
                }

                if (response && response.success) {
                    item.emails = response.data.emails.join(', ');
                    item.webPhones = response.data.phones.join(', ');
                    item.facebook = (response.data.socials.facebook || []).join(', ');
                    item.instagram = (response.data.socials.instagram || []).join(', ');
                    item.twitter = (response.data.socials.twitter || []).join(', ');
                    item.whatsapp = (response.data.socials.whatsapp || []).join(', ');
                    item.telegram = (response.data.socials.telegram || []).join(', ');

                    saveData();
                    updateTable();
                    if (!silent) alert('Enrichment complete!');
                } else {
                    if (!silent) alert('Enrichment failed: ' + (response.error || 'Check console'));
                }
                resolve();
            });
        });
    }

    // Extract Only Button
    extractBtn.addEventListener('click', () => performExtraction(false));

    // Extract and Enrich Button (Silent)
    extractEnrichBtn.addEventListener('click', async () => {
        extractEnrichBtn.disabled = true;
        const btnText = extractEnrichBtn.innerText;
        extractEnrichBtn.innerText = 'Processing...';

        const data = await performExtraction(true);
        if (data) {
            await performEnrichment(data, true);
        }

        extractEnrichBtn.disabled = false;
        extractEnrichBtn.innerText = btnText;
    });

    // Enrich Latest Button
    enrichBtn.addEventListener('click', () => {
        if (currentData.length > 0) {
            performEnrichment(currentData[currentData.length - 1], false);
        }
    });

    // Copy All Button
    copyBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        const text = formatForSheets(currentData);
        copyToClipboard(text, copyBtn);
    });

    // CSV/XLSX/Clear listeners stay same...
    csvBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        const csv = convertToCSV(currentData);
        downloadFile(csv, 'gmaps_export.csv', 'text/csv');
    });

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

    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data?')) {
            currentData = [];
            saveData();
            updateTable();
        }
    });

    function saveData() {
        chrome.storage.local.set({
            businessData: currentData,
            columnOrder: columnOrder.map(c => c.id)
        });
    }

    function updateTable() {
        recordCountEl.innerText = currentData.length;
        renderHeader();
        renderRows();
        enrichBtn.disabled = currentData.length === 0;
    }

    function renderHeader() {
        tableHeader.innerHTML = '';
        columnOrder.forEach(col => {
            const th = document.createElement('th');
            th.innerText = col.label + ' ';
            th.draggable = true;
            th.dataset.id = col.id;

            const btn = document.createElement('button');
            btn.className = 'copy-col-btn';
            btn.dataset.col = col.id;
            btn.title = 'Copy Column';
            btn.innerText = '📋';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = e.target.dataset.col;
                const colData = currentData.map(item => item[colId] || '').join('\n');
                copyToClipboard(colData, e.target);
            });
            th.appendChild(btn);

            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            resizer.addEventListener('mousedown', initResize);
            th.appendChild(resizer);

            th.addEventListener('dragstart', handleDragStart);
            th.addEventListener('dragover', handleDragOver);
            th.addEventListener('dragenter', handleDragEnter);
            th.addEventListener('dragleave', handleDragLeave);
            th.addEventListener('drop', handleDrop);
            th.addEventListener('dragend', handleDragEnd);

            tableHeader.appendChild(th);
        });

        const actionsTh = document.createElement('th');
        actionsTh.innerText = 'Actions';
        tableHeader.appendChild(actionsTh);
    }

    function renderRows() {
        resultsTableBody.innerHTML = '';
        currentData.slice().reverse().forEach((item, index) => {
            const actualIndex = currentData.length - 1 - index;
            const tr = document.createElement('tr');

            columnOrder.forEach(col => {
                const td = document.createElement('td');
                const value = item[col.id] || '';

                if (col.id === 'mapsUrl') {
                    td.innerHTML = `<a href="${value || '#'}" target="_blank">Profile</a> `;
                } else if (col.id === 'website') {
                    td.innerHTML = value ? `<a href="${value}" target="_blank">Link</a> ` : '- ';
                } else if (['hours', 'emails', 'webPhones'].includes(col.id)) {
                    td.innerHTML = `<span title="${value}">${value ? value.substring(0, 15) + '...' : '-'}</span> `;
                } else {
                    td.innerText = value || '- ';
                }

                const btn = document.createElement('button');
                btn.className = 'cell-copy-btn';
                btn.dataset.value = value;
                btn.title = 'Copy ' + col.label;
                btn.innerText = '📋';
                btn.addEventListener('click', (e) => {
                    copyToClipboard(e.target.dataset.value, e.target);
                });
                td.appendChild(btn);
                tr.appendChild(td);
            });

            const actionTd = document.createElement('td');
            actionTd.className = 'action-cell';

            const rowCopyBtn = document.createElement('button');
            rowCopyBtn.className = 'row-copy-btn';
            rowCopyBtn.dataset.index = actualIndex;
            rowCopyBtn.title = 'Copy Full Row for Sheets';
            rowCopyBtn.innerText = '📋 Row';
            rowCopyBtn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                const item = currentData[idx];
                const fields = columnOrder.map(col =>
                    String(item[col.id] || '').replace(/\r?\n|\r/g, ' ').trim()
                );
                copyToClipboard(fields.join('\t'), e.target);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.dataset.index = actualIndex;
            deleteBtn.title = 'Delete Record';
            deleteBtn.innerText = '×';
            deleteBtn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                currentData.splice(idx, 1);
                saveData();
                updateTable();
            });

            actionTd.appendChild(rowCopyBtn);
            actionTd.appendChild(deleteBtn);
            tr.appendChild(actionTd);

            resultsTableBody.appendChild(tr);
        });
    }

    function initResize(e) {
        e.stopPropagation();
        const th = e.target.parentElement;
        const startX = e.pageX;
        const startWidth = th.offsetWidth;

        function startResizing(moveEvent) {
            th.style.width = startWidth + (moveEvent.pageX - startX) + 'px';
            th.style.minWidth = th.style.width;
        }

        function stopResizing() {
            window.removeEventListener('mousemove', startResizing);
            window.removeEventListener('mouseup', stopResizing);
        }

        window.addEventListener('mousemove', startResizing);
        window.addEventListener('mouseup', stopResizing);
    }

    function handleDragStart(e) {
        draggedColumnId = this.dataset.id;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        this.classList.add('over');
    }

    function handleDragLeave(e) {
        this.classList.remove('over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        this.classList.remove('over');

        const targetId = this.dataset.id;
        if (targetId !== draggedColumnId) {
            const dragIdx = columnOrder.findIndex(c => c.id === draggedColumnId);
            const dropIdx = columnOrder.findIndex(c => c.id === targetId);

            const temp = columnOrder.splice(dragIdx, 1)[0];
            columnOrder.splice(dropIdx, 0, temp);

            saveData();
            updateTable();
        }
        return false;
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        document.querySelectorAll('th').forEach(th => th.classList.remove('over'));
        draggedColumnId = null;
    }

    function formatForSheets(data) {
        const headers = columnOrder.map(c => c.label).join('\t') + '\n';
        const rows = data.map(item => {
            const fields = columnOrder.map(col =>
                String(item[col.id] || '').replace(/\r?\n|\r/g, ' ').trim()
            );
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
        const headers = columnOrder.map(c => c.id).join(',');
        const rows = data.map(row => {
            return columnOrder.map(col => {
                const value = row[col.id] || '';
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
