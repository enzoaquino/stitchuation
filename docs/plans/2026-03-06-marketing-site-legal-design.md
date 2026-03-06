# Marketing Site + Legal Documents Design

Simple static marketing site at `stitchuation.app` with privacy policy, terms of service, and support page. Required for Facebook/TikTok OAuth app registration and App Store compliance.

## Site Structure

```
apps/web/
├── index.html          — Landing page
├── privacy.html        — Privacy Policy
├── terms.html          — Terms of Service
├── support.html        — Support/Contact
├── css/style.css       — Shared styles
├── CNAME               — Custom domain (stitchuation.app)
└── .nojekyll           — Disable Jekyll processing
```

## Hosting

GitHub Pages from the `apps/web/` directory, custom domain `stitchuation.app`. Deployed via GitHub Actions on push to `main`.

## Tech

Plain HTML + CSS. No build step, no framework.

## Design

Matches the iOS app's Warm & Refined aesthetic:
- **Fonts**: Playfair Display (headings), Source Serif 4 (body) — Google Fonts
- **Background**: Linen (#FAF0E6)
- **Text**: Espresso (#3C2415), Walnut (#5C4033)
- **Accents**: Terracotta (#C75B39)
- Clean, editorial feel. Minimal layout.

## Pages

### Landing Page (`index.html`)

- Hero: app name "Stitchuation" + tagline "Your craft companion"
- 2-3 feature highlights (inventory management, project tracking, stitch guide)
- App Store download button
- Footer: links to Privacy, Terms, Support

### Privacy Policy (`privacy.html`)

Operating entity: Enzo Aquino (individual developer).

Covers:
- **Data collected**: Email, display name, profile image URL (from social providers), thread inventory, stitch pieces, journal entries with photos
- **Authentication providers**: Apple Sign-In, Facebook Login, TikTok Login, email/password (passwords hashed with bcrypt)
- **Data storage**: PostgreSQL on Azure, images on Azure Blob Storage
- **Third-party services**: Apple (auth + in-app subscriptions), Meta/Facebook (auth), TikTok (auth), Anthropic (AI-powered stitch guide parsing — user-uploaded images sent for analysis)
- **No analytics or tracking**: No third-party analytics, no ad networks, no cookies for tracking
- **Data retention**: Account data kept until user requests deletion
- **Data deletion**: Users can request full account and data deletion via support email
- **Children**: Not directed at children under 13 (COPPA compliance)
- **Contact**: Support email for privacy inquiries
- **California residents**: CCPA notice (right to know, delete, opt-out)

### Terms of Service (`terms.html`)

Covers:
- Account registration and eligibility (13+)
- Subscription terms (monthly/yearly via Apple App Store, managed by Apple's billing)
- User content (inventory data, journal entries, photos) — user retains ownership
- Acceptable use policy
- Account suspension/termination
- Service availability (no uptime guarantee)
- Limitation of liability
- Disclaimer of warranties
- Governing law
- Contact information

### Support Page (`support.html`)

- Support email address
- Brief FAQ (account deletion, subscription management via App Store)
- Link to App Store for subscription management

## Deployment

GitHub Actions workflow:
1. Trigger: push to `main` that changes `apps/web/**`
2. Action: deploy `apps/web/` to GitHub Pages
3. Custom domain: `stitchuation.app` via CNAME file

## DNS

User must configure DNS for `stitchuation.app`:
- A records pointing to GitHub Pages IPs
- Or CNAME record if using `www.stitchuation.app`
