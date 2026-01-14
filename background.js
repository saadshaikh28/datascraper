/**
 * background.js
 * 
 * Handles window opening and enrichment fetching.
 */

chrome.action.onClicked.addListener((tab) => {
    chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 800,
        height: 600
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'enrichData') {
        enrichBusinessData(request.url)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
});

/**
 * Fetches the business website and extracts emails and social links.
 */
async function enrichBusinessData(url) {
    if (!url || url === '-') return {};

    try {
        const response = await fetch(url);
        const html = await response.text();

        // Simple regex for emails
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = Array.from(new Set(html.match(emailRegex) || []));

        // Common social media patterns
        const socials = {
            facebook: html.match(/facebook\.com\/[a-zA-Z0-9._-]+/g) || [],
            instagram: html.match(/instagram\.com\/[a-zA-Z0-9._-]+/g) || [],
            linkedin: html.match(/linkedin\.com\/[a-z]{2,3}\/[a-zA-Z0-9._-]+/g) || [],
            twitter: html.match(/(twitter\.x|x\.com)\/[a-zA-Z0-9._-]+/g) || []
        };

        // Clean up social links
        for (const platform in socials) {
            socials[platform] = Array.from(new Set(socials[platform])).map(link => {
                if (!link.startsWith('http')) return 'https://' + link;
                return link;
            });
        }

        return {
            emails: emails.slice(0, 5), // Limit to top 5
            socials: socials
        };
    } catch (error) {
        console.error('Enrichment failed:', error);
        throw error;
    }
}
