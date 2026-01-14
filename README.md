# Google Maps Business Data Scraper

A lightweight Chrome Extension that extracts business information from Google Maps profiles.

## Features
- **One-click extraction**: Get Name, Category, Address, Phone, Website, Rating, and Hours.
- **Enrichment**: Fetch public emails and social links from the business's official website.
- **Data Persistence**: Extracted data is saved locally in your browser.
- **Export Options**: 
  - **Copy All**: Formatted for easy pasting into Google Sheets or Excel.
  - **Export CSV**: Standard CSV file for data analysis.
  - **Export XLSX**: Excel spreadsheet format (requires XLSX library).

## How to Load this Extension

1. **Download/Save** all files in this directory to a folder on your computer.
2. **Open Chrome** and navigate to `chrome://extensions/`.
3. **Enable Developer Mode** (toggle switch in the top right corner).
4. Click **Load unpacked**.
5. Select the folder containing these files.
6. The extension icon should now appear in your toolbar (you may need to pin it).

## Dependencies

For **XLSX Export** to work, you need to download the `xlsx.full.min.js` library:
1. Create a folder named `libs` inside the extension directory.
2. Download [xlsx.full.min.js](https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js) and save it as `libs/xlsx.full.min.js`.

## Data Extracted
- **Business name**
- **Primary category**
- **Address**
- **Phone number** (Formatted for cells - 10 digits only)
- **Website URL**
- **Opening hours**
- **Rating and review count**
- **Emails & Socials** (via Enrichment)

---
*Note: This tool is for personal use and does not perform automated scraping or crawling.*
