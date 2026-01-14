/**
 * popup.js
 */

document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extractBtn');
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
    // Each column has a key (data property), label (display name), and optional render function
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
            // Reconstruct columnOrder based on saved IDs to maintain structure/renders
            const savedOrder = result.columnOrder;
            const newOrder = [];
            savedOrder.forEach(id => {
                const col = columnOrder.find(c => c.id === id);
                if (col) newOrder.push(col);
            });
            // Add any missing columns (e.g. if we added new fields in a code update)
            columnOrder.forEach(col => {
                if (!newOrder.find(c => c.id === col.id)) newOrder.push(col);
            });
            columnOrder = newOrder;
        }
        updateTable();
    });

    // Extract Info Button
    extractBtn.addEventListener('click', async () => {
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

    // Copy All Button
    copyBtn.addEventListener('click', () => {
        if (currentData.length === 0) return;
        const text = formatForSheets(currentData);
        copyToClipboard(text, copyBtn);
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

            // Resizer
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            resizer.addEventListener('mousedown', initResize);
            th.appendChild(resizer);

            // Drag events
            th.addEventListener('dragstart', handleDragStart);
            th.addEventListener('dragover', handleDragOver);
            th.addEventListener('dragenter', handleDragEnter);
            th.addEventListener('dragleave', handleDragLeave);
            th.addEventListener('drop', handleDrop);
            th.addEventListener('dragend', handleDragEnd);

            tableHeader.appendChild(th);
        });

        // Fixed Actions column
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

                // Custom Rendering for specific columns
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

            // Action Column
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

    // Resizing Logic
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

    // Drag and Drop Logic
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
