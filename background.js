/**
 * background.js
 * 
 * Handles business website enrichment.
 */

chrome.action.onClicked.addListener((tab) => {
    chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 1000,
        height: 700
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'enrichData') {
        enrichBusinessData(request.url)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function enrichBusinessData(url) {
    if (!url || url === '-' || !url.startsWith('http')) return {};

    try {
        const response = await fetch(url);
        const html = await response.text();

        // Create a temporary DOM context for better searching
        // Since we can't use DOMParser in service worker easily without a library,
        // we stick to robust regex that looks specifically for common patterns.

        // 1. Email Extraction (Mailto & Plain Text)
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        let emails = [];
        let m;
        while ((m = mailtoRegex.exec(html)) !== null) emails.push(m[1]);
        while ((m = emailRegex.exec(html)) !== null) emails.push(m[1]);
        emails = [...new Set(emails)];

        // 2. Phone Number Extraction (Tel links & Patterns)
        const telRegex = /tel:(\+?[0-9\s\-()]{7,})/gi;
        const plainPhoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        let phones = [];
        while ((m = telRegex.exec(html)) !== null) phones.push(m[1].replace(/[^0-9]/g, ''));
        while ((m = plainPhoneRegex.exec(html)) !== null) phones.push(m[0].replace(/[^0-9]/g, ''));
        phones = [...new Set(phones)].filter(p => p.length >= 7);

        // 3. Social Media & Messaging Links
        const socialPatterns = {
            facebook: /(?:facebook\.com|fb\.com|fb\.me)\/([a-zA-Z0-9._-]+)/gi,
            instagram: /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._-]+)/gi,
            linkedin: /linkedin\.com\/(?:company|in|school)\/([a-zA-Z0-9._-]+)/gi,
            twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9._-]+)/gi,
            whatsapp: /(?:wa\.me|api\.whatsapp\.com\/send\?phone=|chat\.whatsapp\.com\/)([a-zA-Z0-9._-]+)/gi,
            telegram: /(?:t\.me|telegram\.me)\/([a-zA-Z0-9._-]+)/gi
        };

        const socials = {};
        for (const [platform, regex] of Object.entries(socialPatterns)) {
            const matches = [];
            let match;
            while ((match = regex.exec(html)) !== null) {
                let link = match[0];
                // Clean up: avoid common sub-folders but keep profile ID
                if (link.includes('facebook.com/tr')) continue;
                if (!link.startsWith('http')) link = 'https://' + link;
                matches.push(link);
            }
            socials[platform] = [...new Set(matches)];
        }

        return {
            emails: emails.slice(0, 10),
            phones: phones.slice(0, 5),
            socials: socials
        };
    } catch (error) {
        console.error('Enrichment failed for', url, error);
        throw error;
    }
}
