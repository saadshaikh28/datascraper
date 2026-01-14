/**
 * content.js
 * 
 * This script runs in the context of the Google Maps page.
 * It waits for a message from the popup to extract business data.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        const data = extractBusinessInfo();
        sendResponse({ data: data });
    }
});

/**
 * Extracts business information from the visible page.
 * Uses robust selectors targeting aria-labels and data-item-ids.
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
        timestamp: new Date().toISOString()
    };

    try {
        // 1. Business Name - Usually the only H1 in the left panel
        const nameEl = document.querySelector('h1.DUwDvf');
        if (nameEl) info.name = nameEl.innerText.trim();

        // 2. Primary Category
        const categoryEl = document.querySelector('button.DqE26');
        if (categoryEl) info.category = categoryEl.innerText.trim();

        // 3. Address
        const addressEl = document.querySelector('button[data-item-id="address"]');
        if (addressEl) info.address = addressEl.innerText.trim();

        // 4. Phone Number
        const phoneEl = document.querySelector('button[data-item-id*="phone:tel:"]');
        if (phoneEl) {
            const rawPhone = phoneEl.innerText.trim();
            // Format: remove spaces, dashes, and country code if possible
            // User requested "without the country code"
            info.phone = formatPhoneNumber(rawPhone);
        }

        // 5. Website URL
        const websiteEl = document.querySelector('a[data-item-id="authority"]');
        if (websiteEl) info.website = websiteEl.href;

        // 6. Rating and Review Count
        // Target the rating container
        const ratingEl = document.querySelector('span.fontBodyMedium span[aria-label*="stars"]');
        if (ratingEl) {
            info.rating = ratingEl.getAttribute('aria-label').split(' ')[0];
        }

        const reviewsEl = document.querySelector('span.fontBodyMedium span[aria-label*="reviews"]');
        if (reviewsEl) {
            // Extract numbers only
            info.reviewCount = reviewsEl.getAttribute('aria-label').replace(/[^0-9]/g, '');
        }

        // 7. Opening Hours
        // Hours are often in a button that expands
        const hoursEl = document.querySelector('div[aria-label*="Hours"]');
        if (hoursEl) {
            info.hours = hoursEl.innerText.trim().replace(/\n/g, '; ');
        } else {
            // Fallback for some layouts
            const hoursTable = document.querySelector('table.eKjh9c');
            if (hoursTable) {
                info.hours = hoursTable.innerText.trim().replace(/\n/g, '; ');
            }
        }

    } catch (error) {
        console.error('Error extracting G-Maps data:', error);
    }

    return info;
}

/**
 * Helper to strip country code and format for Excel/Google Sheets.
 * Simple logic: get last 10 digits for common formats, or strip non-numeric and leading digits if they look like country codes.
 */
function formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let numeric = phone.replace(/[^0-9]/g, '');

    // If it's longer than 10 digits, it likely has a country code
    if (numeric.length > 10) {
        // Take the last 10 digits as a heuristic for local number
        return numeric.slice(-10);
    }

    return numeric || phone;
}
