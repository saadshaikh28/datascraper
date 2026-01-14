/**
 * content.js - Robust Version
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        console.log('[G-Maps Organizer] Extraction requested...');
        const data = extractBusinessInfo();
        console.log('[G-Maps Organizer] Extracted Data:', data);
        sendResponse({ data: data });
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
        mapsUrl: window.location.href,
        timestamp: new Date().toISOString()
    };

    try {
        // 1. Business Name - Most reliable is the single H1 or the specific class
        const nameEl = document.querySelector('h1.DUwDvf') || document.querySelector('h1');
        if (nameEl) info.name = nameEl.innerText.trim();

        // 2. Primary Category
        const categoryEl = document.querySelector('button.DqE26') ||
            document.querySelector('button[jsaction*="category"]');
        if (categoryEl) info.category = categoryEl.innerText.trim();

        // 3. Address
        const addressEl = document.querySelector('button[data-item-id="address"]') ||
            document.querySelector('div[aria-label*="Address"]');
        if (addressEl) info.address = addressEl.innerText.trim();

        // 4. Phone Number
        const phoneEl = document.querySelector('button[data-item-id*="phone:tel:"]') ||
            document.querySelector('button[aria-label*="Phone"]');
        if (phoneEl) {
            info.phone = formatPhoneNumber(phoneEl.innerText.trim());
        }

        // 5. Website URL
        const websiteEl = document.querySelector('a[data-item-id="authority"]') ||
            document.querySelector('a[aria-label*="Website"]');
        if (websiteEl) info.website = websiteEl.href;

        // 6. Rating and Review Count
        try {
            // Method A: Look for the consolidated stats container
            const statsContainer = document.querySelector('div.F7kYv') ||
                document.querySelector('span.fontBodyMedium') ||
                document.querySelector('div.fontBodyMedium');

            if (statsContainer) {
                const text = statsContainer.innerText || statsContainer.getAttribute('aria-label') || '';
                // Rating: Look for 4.5 or 4,5
                const ratingMatch = text.match(/(\d[.,]\d)/);
                if (ratingMatch) info.rating = ratingMatch[1].replace(',', '.');

                // Reviews: Look for numbers in parentheses like (1,234) or followed by "reviews"
                const reviewsMatch = text.match(/\(([\d,.]+)\)/) || text.match(/([\d,.]+)\s*reviews/i);
                if (reviewsMatch) info.reviewCount = reviewsMatch[1].replace(/[^0-9]/g, '');
            }

            // Method B: Fallback to specific elements if Method A missed something
            if (!info.rating) {
                const ratingEl = document.querySelector('span.ceNzR[aria-label*="stars"]') ||
                    document.querySelector('span[aria-label*="stars"]') ||
                    document.querySelector('span.MW4v7d');
                if (ratingEl) {
                    const label = ratingEl.getAttribute('aria-label') || ratingEl.innerText;
                    const match = label.match(/(\d[.,]\d)/) || label.match(/(\d)/);
                    if (match) info.rating = match[0].replace(',', '.');
                }
            }

            if (!info.reviewCount) {
                const reviewsEl = document.querySelector('button[aria-label*="reviews"]') ||
                    document.querySelector('span[aria-label*="reviews"]') ||
                    document.querySelector('span.a09hYc') ||
                    document.querySelector('span.fontBodyMedium span:last-child');
                if (reviewsEl) {
                    const label = reviewsEl.getAttribute('aria-label') || reviewsEl.innerText;
                    const count = label.replace(/[^0-9]/g, '');
                    if (count) info.reviewCount = count;
                }
            }
        } catch (e) {
            console.error('[G-Maps Organizer] Rating/Review extraction error:', e);
        }

        // 7. Opening Hours
        const hoursEl = document.querySelector('div[jsaction*="hours"]') ||
            document.querySelector('div[aria-label*="Hours"]') ||
            document.querySelector('table.eKjh9c');
        if (hoursEl) {
            info.hours = hoursEl.innerText.trim().replace(/\n/g, '; ');
        }

    } catch (error) {
        console.error('[G-Maps Organizer] Error during extraction:', error);
    }

    // Final Sanitization: Remove all newlines within fields to prevent Google Sheets row splitting
    for (let key in info) {
        if (typeof info[key] === 'string' && key !== 'timestamp') {
            info[key] = info[key].replace(/\r?\n|\r/g, ' ').trim();
        }
    }

    return info;
}

/**
 * Helper to strip country code and format for Excel/Google Sheets.
 */
function formatPhoneNumber(phone) {
    // Remove all non-numeric characters (removes +, -, spaces, etc.)
    // Keeping only digits ensures the country code is included without the "+" 
    // leading to formula errors in Google Sheets.
    return phone.replace(/[^0-9]/g, '');
}
