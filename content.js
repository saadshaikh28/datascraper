/**
 * content.js - Robust Scoped Version
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        console.log('[G-Maps Organizer] Extraction requested...');
        const data = extractBusinessInfo();
        console.log('[G-Maps Organizer] Extracted Data:', data);
        sendResponse({ data: data });
    } else if (request.action === 'clickNext') {
        const success = clickResultByIndex(request.index);
        sendResponse({ success });
    } else if (request.action === 'checkProfileLoaded') {
        const isLoaded = !!(document.querySelector('h1.DUwDvf') || document.querySelector('h1'));
        sendResponse({ isLoaded });
    }
    return true; // Keep channel open
});

/**
 * Extracts business information from the visible page.
 */
function extractBusinessInfo() {
    const info = {
        name: '',
        category: '',
        address: '',
        phone: '',
        website: '',
        hours: '',
        rating: '',
        reviewCount: '',
        placeId: '',
        mapsUrl: window.location.href,
        timestamp: new Date().toISOString()
    };

    try {
        // 0. Identify the Active Detail Pane
        // We look for the main H1 which is the business name.
        const nameEl = document.querySelector('h1.DUwDvf') || document.querySelector('h1');
        if (!nameEl) {
            console.warn('[G-Maps Organizer] No Business Name found. Ensure a profile is open.');
            return info;
        }

        info.name = nameEl.innerText.trim();

        // Lock search to the specific sidebar container holding this business
        // This prevents grabbing data from the search result list on the left.
        const detailPane = nameEl.closest('div[role="main"]') ||
            nameEl.closest('.m67pLc') ||
            nameEl.closest('.bJz19') ||
            document.body;

        console.log('[G-Maps Organizer] Scoping extraction to container:', detailPane);

        // 1. Primary Category
        const categoryEl = detailPane.querySelector('button.DqE26') ||
            detailPane.querySelector('button[jsaction*="category"]');
        if (categoryEl) info.category = categoryEl.innerText.trim();

        // 2. Address
        const addressEl = detailPane.querySelector('button[data-item-id="address"]') ||
            detailPane.querySelector('div[aria-label*="Address"]');
        if (addressEl) info.address = addressEl.innerText.trim();

        // 3. Phone Number
        const phoneEl = detailPane.querySelector('button[data-item-id*="phone:tel:"]') ||
            detailPane.querySelector('button[aria-label*="Phone"]');
        if (phoneEl) {
            info.phone = formatPhoneNumber(phoneEl.innerText.trim());
        }

        // 4. Website URL
        const websiteEl = detailPane.querySelector('a[data-item-id="authority"]') ||
            detailPane.querySelector('a[aria-label*="Website"]');
        if (websiteEl) info.website = websiteEl.href;

        // 5. Rating and Review Count
        try {
            // Priority 1: Consolidated stats container (e.g. "4.5 (1,234 reviews)")
            const statsContainer = detailPane.querySelector('div.F7kYv') ||
                detailPane.querySelector('span.fontBodyMedium') ||
                detailPane.querySelector('div.fontBodyMedium');

            if (statsContainer) {
                const text = statsContainer.innerText || statsContainer.getAttribute('aria-label') || '';
                const ratingMatch = text.match(/(\d[.,]\d)/);
                if (ratingMatch) info.rating = ratingMatch[1].replace(',', '.');

                const reviewsMatch = text.match(/\(([\d,.]+)\)/) || text.match(/([\d,.]+)\s*reviews/i);
                if (reviewsMatch) info.reviewCount = reviewsMatch[1].replace(/[^0-9]/g, '');
            }

            // Fallback for Rating
            if (!info.rating) {
                const ratingEl = detailPane.querySelector('span.ceNzR[aria-label*="stars"]') ||
                    detailPane.querySelector('span[aria-label*="stars"]') ||
                    detailPane.querySelector('span.MW4v7d');
                if (ratingEl) {
                    const label = ratingEl.getAttribute('aria-label') || ratingEl.innerText;
                    const match = label.match(/(\d[.,]\d)/) || label.match(/(\d)/);
                    if (match) info.rating = match[0].replace(',', '.');
                }
            }

            // Fallback for Review Count
            if (!info.reviewCount) {
                const reviewsEl = detailPane.querySelector('button[aria-label*="reviews"]') ||
                    detailPane.querySelector('span[aria-label*="reviews"]') ||
                    detailPane.querySelector('span.a09hYc');
                if (reviewsEl) {
                    const label = reviewsEl.getAttribute('aria-label') || reviewsEl.innerText;
                    const count = label.replace(/[^0-9]/g, '');
                    if (count) info.reviewCount = count;
                }
            }
        } catch (e) {
            console.error('[G-Maps Organizer] Rating/Review extraction error:', e);
        }

        // 6. Opening Hours
        const hoursEl = detailPane.querySelector('div[jsaction*="hours"]') ||
            detailPane.querySelector('div[aria-label*="Hours"]') ||
            detailPane.querySelector('table.eKjh9c');
        if (hoursEl) {
            info.hours = hoursEl.innerText.trim().replace(/\n/g, '; ');
        }

        // 7. Place ID (Unique Google Identifier)
        try {
            // Method 1: Check for "Share" button
            const shareBtn = detailPane.querySelector('button[data-value="Share"]') ||
                detailPane.querySelector('button[aria-label*="Share"]') ||
                detailPane.querySelector('button[data-tooltip="Share"]');

            if (shareBtn) {
                const pid = shareBtn.getAttribute('data-place-id');
                if (pid && pid.startsWith('ChIJ')) info.placeId = pid;
            }

            // Method 2: Check for "Review" button
            if (!info.placeId) {
                const reviewBtn = detailPane.querySelector('button[jsaction*="review"]');
                if (reviewBtn) {
                    const pid = reviewBtn.getAttribute('data-place-id');
                    if (pid && pid.startsWith('ChIJ')) info.placeId = pid;
                }
            }

            // Method 3: URL Pattern (Failsafe)
            if (!info.placeId) {
                const urlMatch = window.location.href.match(/!1s(ChIJ[a-zA-Z0-9_-]{23})/);
                // Check if the page title roughly matches the business name we extracted
                if (urlMatch && document.title.toLowerCase().includes(info.name.toLowerCase().substring(0, 5))) {
                    info.placeId = urlMatch[1];
                }
            }

            // Final Failsafe: Deep Scan innerHTML of ONLY the detail pane
            if (!info.placeId && detailPane !== document.body) {
                const match = detailPane.innerHTML.match(/ChIJ[a-zA-Z0-9_-]{23}/);
                if (match) info.placeId = match[0];
            }
        } catch (e) {
            console.error('[G-Maps Organizer] Place ID extraction error:', e);
        }

    } catch (error) {
        console.error('[G-Maps Organizer] Error during extraction:', error);
    }

    // Final Sanitization: Remove all newlines within fields
    for (let key in info) {
        if (typeof info[key] === 'string' && key !== 'timestamp') {
            info[key] = info[key].replace(/\r?\n|\r/g, ' ').trim();
        }
    }

    return info;
}

function clickResultByIndex(index) {
    // Aggressive list discovery
    const selectors = ['a.hfpxzc', '[role="article"] a', 'a[href*="/maps/place/"]'];
    let resultItems = [];

    for (const sel of selectors) {
        const items = document.querySelectorAll(sel);
        if (items.length > 0) {
            resultItems = Array.from(items);
            break;
        }
    }

    console.log(`[G-Maps Organizer] Auto-Sequence: Found ${resultItems.length} results. Trying index ${index}`);

    if (resultItems.length > index) {
        const target = resultItems[index];
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Give it a moment to scroll
        setTimeout(() => {
            target.focus();
            target.click();
        }, 600);

        return true;
    }
    return false;
}

/**
 * Helper to strip country code and format for Excel/Google Sheets.
 */
function formatPhoneNumber(phone) {
    return phone.replace(/[^0-9]/g, '');
}
