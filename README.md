# Google Maps Business Data Research Tool

A lightweight Chrome Extension that extracts business information from Google Maps profiles.

## How to Use

1. **Open Google Maps** and navigate to a business profile.
2. **Click the Extension Icon** in your toolbar.
3. A **standalone window** will open. You can resize this window or move it to another screen for better research.
4. Click **Extract Business Info** to capture the data from your Maps tab.
5. Use the **clipboard icons (📋)** as needed:
   - **Top Header**: Copy an entire column.
   - **Next to Data**: Copy a single cell.
   - **Row End**: Copy the entire row for Google Sheets.
6. Click **Enrich from Website** to fetch extra details like emails.

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
*Note: This tool is for personal use and does not perform automated extraction or crawling.*
