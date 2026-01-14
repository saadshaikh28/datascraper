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

        // 1. Email Extraction
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = Array.from(new Set(html.match(emailRegex) || []));

        // 2. Phone Number Extraction from Website (Regex for international formats)
        const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const websitePhones = Array.from(new Set(html.match(phoneRegex) || []))
            .map(p => p.replace(/[^0-9]/g, ''));

        // 3. Social Media & Messaging Links
        const socialPatterns = {
            facebook: /facebook\.com\/[a-zA-Z0-9._-]+/g,
            instagram: /instagram\.com\/[a-zA-Z0-9._-]+/g,
            linkedin: /linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/g,
            twitter: /(?:twitter\.com|x\.com)\/[a-zA-Z0-9._-]+/g,
            whatsapp: /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/g,
            telegram: /(?:t\.me|telegram\.me)\/([a-zA-Z0-9._-]+)/g
        };

        const socials = {};
        for (const [platform, regex] of Object.entries(socialPatterns)) {
            const matches = html.match(regex) || [];
            socials[platform] = Array.from(new Set(matches)).map(link => {
                if (platform === 'whatsapp' || platform === 'telegram') return link; // Keep raw match for these
                if (!link.startsWith('http')) return 'https://' + link;
                return link;
            });
        }

        return {
            emails: emails.slice(0, 5),
            phones: websitePhones.slice(0, 3),
            socials: socials
        };
    } catch (error) {
        console.error('Enrichment failed:', error);
        throw error;
    }
}
