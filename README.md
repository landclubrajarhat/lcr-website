# Land Club Rajarhat — Concept Website v1.0

বাংলা-প্রধান, responsive, static demonstration website for Land Club Rajarhat's **discussion stage**.

## Run
Open `index.html` in a browser, or serve the folder with `python -m http.server 8000` and visit `http://localhost:8000`.

## Sections
Home, About, Governance, Project Concepts, 20 Dummy Member Profiles, Proposed Profit Allocation, Planning Dashboard, Interest Form, Contact.

## Important limitations
- All member profiles and project cards are placeholders.
- The dashboard is static planning/demo data, **not connected to finance or member records**.
- The interest form stores entries **only in the current browser's localStorage**. It does not submit to LCR or any server, and is not suitable for production data collection. To erase: browser developer tools > Application > Local Storage > `lcr-demo-interest`.
- No authentication, admin panel, financial ledger, bank integration, or secure database exists in this version.
- The proposed profit split, committees, share price and exit policy are unapproved draft concepts requiring legal/financial review.
- Images load from Unsplash and fonts from Google Fonts; internet access is needed for these assets.

## Update workflow
- Edit `index.html` for content and sections.
- Edit `styles.css` for layout, colors, typography.
- Edit `app.js` for placeholder member data and interactions.
- Later, move member/project data into a protected database with proper permissions.

## Deployment
This folder can be deployed as a static site to Cloudflare Pages, GitHub Pages or Netlify. Do not publish real member personal/financial data in static source files.
