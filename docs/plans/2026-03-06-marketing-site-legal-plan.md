# Marketing Site + Legal Documents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a static marketing site at stitchuation.app with privacy policy, terms of service, support page, and landing page.

**Architecture:** Plain HTML + CSS, no build step. Hosted on GitHub Pages from `apps/web/`. Deployed via a new GitHub Actions workflow triggered on push to `main` when `apps/web/**` changes. Matches the iOS app's Warm & Refined design system.

**Tech Stack:** HTML, CSS, GitHub Pages, GitHub Actions

---

### Task 1: Create shared CSS stylesheet

**Files:**
- Create: `apps/web/css/style.css`

**Step 1: Create the stylesheet**

Create `apps/web/css/style.css` with the design system tokens and page layout styles:

```css
/* Fonts */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap');

/* Design Tokens */
:root {
  --linen: #F5F0E8;
  --parchment: #EDE6D8;
  --cream: #FAF7F2;
  --espresso: #3B2F2F;
  --walnut: #5C4A3D;
  --clay: #8B7355;
  --terracotta: #C4704B;
  --terracotta-light: #D4896A;
  --terracotta-muted: #E8C4B0;
  --sage: #7A8B6F;
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Source Serif 4', Georgia, serif;
  background-color: var(--linen);
  color: var(--espresso);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

/* Typography */
h1, h2, h3 {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
  line-height: 1.3;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 1.75rem; margin-top: 2.5rem; margin-bottom: 1rem; }
h3 { font-size: 1.25rem; margin-top: 2rem; margin-bottom: 0.75rem; }

p { margin-bottom: 1rem; color: var(--walnut); }

a {
  color: var(--terracotta);
  text-decoration: none;
  transition: color 0.2s;
}

a:hover { color: var(--terracotta-light); }

ul, ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  color: var(--walnut);
}

li { margin-bottom: 0.4rem; }

/* Layout */
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* Header */
.site-header {
  text-align: center;
  padding: 2rem 1.5rem 1rem;
  border-bottom: 1px solid var(--parchment);
}

.site-header a {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--espresso);
}

/* Footer */
.site-footer {
  text-align: center;
  padding: 2rem 1.5rem;
  border-top: 1px solid var(--parchment);
  color: var(--clay);
  font-size: 0.875rem;
}

.site-footer nav {
  margin-bottom: 0.75rem;
}

.site-footer nav a {
  margin: 0 0.75rem;
  color: var(--clay);
}

.site-footer nav a:hover {
  color: var(--terracotta);
}

/* Hero (landing page) */
.hero {
  text-align: center;
  padding: 4rem 1.5rem 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.hero .tagline {
  font-family: 'Source Serif 4', Georgia, serif;
  font-style: italic;
  font-size: 1.25rem;
  color: var(--walnut);
  margin-bottom: 2.5rem;
}

.hero .cta {
  display: inline-block;
  background: var(--espresso);
  color: var(--cream);
  padding: 0.875rem 2rem;
  border-radius: 8px;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
}

.hero .cta:hover {
  background: var(--walnut);
  color: var(--cream);
}

/* Features (landing page) */
.features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  padding: 2rem 1.5rem 3rem;
  max-width: 720px;
  margin: 0 auto;
}

@media (min-width: 640px) {
  .features { grid-template-columns: repeat(3, 1fr); }
}

.feature {
  text-align: center;
}

.feature .icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.feature h3 {
  margin-top: 0;
  font-size: 1.1rem;
}

.feature p {
  font-size: 0.95rem;
}

/* Legal pages */
.legal-page h1 {
  margin-bottom: 0.5rem;
}

.legal-page .effective-date {
  color: var(--clay);
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

/* Responsive */
@media (max-width: 480px) {
  h1 { font-size: 2rem; }
  .hero h1 { font-size: 2.25rem; }
  .container { padding: 1.5rem 1rem; }
}
```

**Step 2: Commit**

```bash
git add apps/web/css/style.css
git commit -m "feat(web): add shared CSS stylesheet with design system tokens"
```

---

### Task 2: Create the landing page

**Files:**
- Create: `apps/web/index.html`

**Step 1: Create the landing page**

Create `apps/web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stitchuation — Your Craft Companion</title>
  <meta name="description" content="Manage your needlepoint thread collection, track projects, and parse stitch guides with AI. Available on iOS.">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <section class="hero">
    <h1>Stitchuation</h1>
    <p class="tagline">Your craft companion</p>
    <a href="https://apps.apple.com/app/stitchuation" class="cta">Download on the App Store</a>
  </section>

  <section class="features">
    <div class="feature">
      <div class="icon">🧵</div>
      <h3>Thread Inventory</h3>
      <p>Track your entire thread collection by brand, color, and quantity. Search by color name or hex code.</p>
    </div>
    <div class="feature">
      <div class="icon">🪡</div>
      <h3>Project Tracking</h3>
      <p>Manage your needlepoint pieces from stash to finished. Keep a journal with photos of your progress.</p>
    </div>
    <div class="feature">
      <div class="icon">✨</div>
      <h3>Stitch Guide Parsing</h3>
      <p>Upload a stitch guide image and let AI extract the materials list directly into your inventory.</p>
    </div>
  </section>

  <footer class="site-footer">
    <nav>
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms of Service</a>
      <a href="support.html">Support</a>
    </nav>
    <p>&copy; 2026 Enzo Aquino. All rights reserved.</p>
  </footer>
</body>
</html>
```

**Step 2: Commit**

```bash
git add apps/web/index.html
git commit -m "feat(web): add landing page"
```

---

### Task 3: Create the Privacy Policy

**Files:**
- Create: `apps/web/privacy.html`

**Step 1: Create the privacy policy page**

Create `apps/web/privacy.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Stitchuation</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header">
    <a href="index.html">Stitchuation</a>
  </header>

  <main class="container legal-page">
    <h1>Privacy Policy</h1>
    <p class="effective-date">Effective date: March 6, 2026</p>

    <p>Stitchuation ("we", "our", "the app") is operated by Enzo Aquino. This Privacy Policy explains how we collect, use, and protect your information when you use the Stitchuation iOS app and related services.</p>

    <h2>Information We Collect</h2>

    <h3>Account Information</h3>
    <p>When you create an account, we collect:</p>
    <ul>
      <li><strong>Email address</strong> — used for account identification and communication</li>
      <li><strong>Display name</strong> — shown within the app</li>
      <li><strong>Password</strong> (if using email/password login) — stored as a one-way cryptographic hash using bcrypt; we never store your actual password</li>
    </ul>

    <h3>Social Login Information</h3>
    <p>If you sign in with a third-party provider, we receive:</p>
    <ul>
      <li><strong>Apple Sign-In</strong>: Your Apple user ID and email (which may be a private relay address)</li>
      <li><strong>Facebook Login</strong>: Your Facebook user ID, name, email, and profile picture URL</li>
      <li><strong>TikTok Login</strong>: Your TikTok user ID, display name, and profile picture URL</li>
    </ul>
    <p>We do not receive or store your passwords from any social login provider.</p>

    <h3>Content You Create</h3>
    <p>The app stores data you choose to enter:</p>
    <ul>
      <li>Thread inventory (brand, number, color, quantity, notes)</li>
      <li>Needlepoint pieces (designer, design name, status, dimensions)</li>
      <li>Journal entries and photos</li>
      <li>Materials lists for projects</li>
    </ul>

    <h3>AI Features</h3>
    <p>When you use the stitch guide parsing feature, the image you upload is sent to Anthropic's API for analysis. Anthropic processes the image to extract materials information and does not retain your images after processing. See <a href="https://www.anthropic.com/privacy">Anthropic's Privacy Policy</a> for details.</p>

    <h2>How We Use Your Information</h2>
    <ul>
      <li>To provide and maintain the app's functionality</li>
      <li>To authenticate your account</li>
      <li>To sync your data across devices</li>
      <li>To process stitch guide images using AI</li>
    </ul>
    <p>We do not sell your personal information. We do not use your data for advertising.</p>

    <h2>Analytics and Tracking</h2>
    <p>We do not use any third-party analytics services, ad networks, or tracking tools. We do not use cookies for tracking purposes. The app does not contain any advertising.</p>

    <h2>Data Storage and Security</h2>
    <p>Your data is stored on Microsoft Azure infrastructure:</p>
    <ul>
      <li>Account and content data in a PostgreSQL database</li>
      <li>Images in Azure Blob Storage</li>
    </ul>
    <p>All data is transmitted over encrypted HTTPS connections. Passwords are hashed using bcrypt with a cost factor of 12. Authentication tokens expire after 15 minutes (access) and 30 days (refresh).</p>

    <h2>Third-Party Services</h2>
    <p>We share data with the following services only as needed to operate the app:</p>
    <ul>
      <li><strong>Apple</strong> — authentication (Sign in with Apple) and subscription billing (App Store)</li>
      <li><strong>Meta/Facebook</strong> — authentication (Facebook Login)</li>
      <li><strong>TikTok</strong> — authentication (TikTok Login)</li>
      <li><strong>Anthropic</strong> — AI image analysis for stitch guide parsing</li>
      <li><strong>Microsoft Azure</strong> — cloud infrastructure (database and image storage)</li>
    </ul>

    <h2>Data Retention</h2>
    <p>We retain your account and content data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days. Some data may be retained in encrypted backups for up to 90 days.</p>

    <h2>Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li><strong>Access</strong> your data — all your content is visible within the app</li>
      <li><strong>Delete</strong> your data — contact us to request full account deletion</li>
      <li><strong>Export</strong> your data — contact us to request a copy of your data</li>
    </ul>

    <h3>California Residents (CCPA)</h3>
    <p>If you are a California resident, you have the right to know what personal information we collect, request deletion of your personal information, and opt out of the sale of personal information. We do not sell personal information.</p>

    <h2>Children's Privacy</h2>
    <p>Stitchuation is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it.</p>

    <h2>Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the effective date.</p>

    <h2>Contact Us</h2>
    <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
    <p><a href="mailto:privacy@stitchuation.app">privacy@stitchuation.app</a></p>
  </main>

  <footer class="site-footer">
    <nav>
      <a href="index.html">Home</a>
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms of Service</a>
      <a href="support.html">Support</a>
    </nav>
    <p>&copy; 2026 Enzo Aquino. All rights reserved.</p>
  </footer>
</body>
</html>
```

**Step 2: Commit**

```bash
git add apps/web/privacy.html
git commit -m "feat(web): add privacy policy page"
```

---

### Task 4: Create the Terms of Service

**Files:**
- Create: `apps/web/terms.html`

**Step 1: Create the terms of service page**

Create `apps/web/terms.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — Stitchuation</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header">
    <a href="index.html">Stitchuation</a>
  </header>

  <main class="container legal-page">
    <h1>Terms of Service</h1>
    <p class="effective-date">Effective date: March 6, 2026</p>

    <p>These Terms of Service ("Terms") govern your use of the Stitchuation app and related services ("Service"), operated by Enzo Aquino ("we", "our"). By using the Service, you agree to these Terms.</p>

    <h2>1. Eligibility</h2>
    <p>You must be at least 13 years old to use Stitchuation. By creating an account, you represent that you meet this age requirement.</p>

    <h2>2. Your Account</h2>
    <p>You are responsible for maintaining the security of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately if you suspect unauthorized access.</p>

    <h2>3. Subscriptions and Payments</h2>
    <p>Stitchuation offers subscription plans (monthly and yearly) through the Apple App Store. All billing is managed by Apple. Subscription terms, pricing, renewals, and cancellations are subject to Apple's terms and your App Store settings. We do not process payments directly.</p>
    <p>You can manage or cancel your subscription at any time through your device's App Store settings.</p>

    <h2>4. Your Content</h2>
    <p>You retain ownership of all content you create in Stitchuation, including thread inventory data, project information, journal entries, and photos. By using the Service, you grant us a limited license to store, process, and display your content solely to provide the Service to you.</p>
    <p>You are responsible for the content you upload. Do not upload content that violates the rights of others or any applicable laws.</p>

    <h2>5. AI Features</h2>
    <p>The stitch guide parsing feature uses artificial intelligence to analyze images you upload. While we strive for accuracy, AI-generated results may contain errors. You should verify the output before relying on it. We are not responsible for inaccuracies in AI-generated content.</p>

    <h2>6. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service for any unlawful purpose</li>
      <li>Attempt to gain unauthorized access to the Service or its systems</li>
      <li>Interfere with or disrupt the Service</li>
      <li>Upload malicious content, viruses, or harmful code</li>
      <li>Use the Service to harass, abuse, or harm others</li>
      <li>Create multiple accounts for deceptive purposes</li>
    </ul>

    <h2>7. Account Termination</h2>
    <p>You may delete your account at any time by contacting us. We may suspend or terminate your account if you violate these Terms. Upon termination, your data will be deleted in accordance with our <a href="privacy.html">Privacy Policy</a>.</p>

    <h2>8. Service Availability</h2>
    <p>We strive to keep Stitchuation available and reliable, but we do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or reasons beyond our control.</p>

    <h2>9. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, Stitchuation and its operator shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.</p>

    <h2>10. Disclaimer of Warranties</h2>
    <p>The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied. We do not warrant that the Service will be error-free, secure, or uninterrupted. The app provides tools for tracking craft supplies and projects; it does not provide professional craft, materials, or safety advice.</p>

    <h2>11. Changes to These Terms</h2>
    <p>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and updating the effective date. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

    <h2>12. Governing Law</h2>
    <p>These Terms are governed by the laws of the State of New York, United States, without regard to conflict of law principles.</p>

    <h2>13. Contact Us</h2>
    <p>If you have questions about these Terms, contact us at:</p>
    <p><a href="mailto:support@stitchuation.app">support@stitchuation.app</a></p>
  </main>

  <footer class="site-footer">
    <nav>
      <a href="index.html">Home</a>
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms of Service</a>
      <a href="support.html">Support</a>
    </nav>
    <p>&copy; 2026 Enzo Aquino. All rights reserved.</p>
  </footer>
</body>
</html>
```

**Step 2: Commit**

```bash
git add apps/web/terms.html
git commit -m "feat(web): add terms of service page"
```

---

### Task 5: Create the Support page

**Files:**
- Create: `apps/web/support.html`

**Step 1: Create the support page**

Create `apps/web/support.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support — Stitchuation</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header">
    <a href="index.html">Stitchuation</a>
  </header>

  <main class="container">
    <h1>Support</h1>

    <p>Need help with Stitchuation? We're here for you.</p>

    <h2>Contact Us</h2>
    <p>Email us at <a href="mailto:support@stitchuation.app">support@stitchuation.app</a> and we'll get back to you as soon as possible.</p>

    <h2>Frequently Asked Questions</h2>

    <h3>How do I delete my account?</h3>
    <p>Send an email to <a href="mailto:support@stitchuation.app">support@stitchuation.app</a> with the subject "Account Deletion" and we will delete your account and all associated data within 30 days.</p>

    <h3>How do I manage my subscription?</h3>
    <p>Subscriptions are managed through the Apple App Store. Open <strong>Settings</strong> on your device, tap your name, then tap <strong>Subscriptions</strong> to view, change, or cancel your Stitchuation subscription.</p>

    <h3>How do I request a copy of my data?</h3>
    <p>Email <a href="mailto:privacy@stitchuation.app">privacy@stitchuation.app</a> with the subject "Data Export Request" and we will send you a copy of your data.</p>

    <h3>I forgot my password</h3>
    <p>If you signed up with email and password, you can reset it from the login screen. If you signed in with Apple, Facebook, or TikTok, use that same provider to sign in again — no password is needed.</p>
  </main>

  <footer class="site-footer">
    <nav>
      <a href="index.html">Home</a>
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms of Service</a>
      <a href="support.html">Support</a>
    </nav>
    <p>&copy; 2026 Enzo Aquino. All rights reserved.</p>
  </footer>
</body>
</html>
```

**Step 2: Commit**

```bash
git add apps/web/support.html
git commit -m "feat(web): add support page with FAQ"
```

---

### Task 6: Add GitHub Pages config files and deployment workflow

**Files:**
- Create: `apps/web/CNAME`
- Create: `apps/web/.nojekyll`
- Create: `.github/workflows/deploy-web.yml`

**Step 1: Create CNAME file**

Create `apps/web/CNAME` (no file extension, single line, no trailing newline):

```
stitchuation.app
```

**Step 2: Create .nojekyll file**

Create `apps/web/.nojekyll` as an empty file. This tells GitHub Pages to serve the files directly without Jekyll processing.

**Step 3: Create deployment workflow**

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Website

on:
  push:
    branches: [main]
    paths: ['apps/web/**']

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: apps/web

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Step 4: Commit**

```bash
git add apps/web/CNAME apps/web/.nojekyll .github/workflows/deploy-web.yml
git commit -m "feat(web): add GitHub Pages config and deployment workflow"
```

---

### Task 7: Push and verify deployment

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Verify**

After push, check the GitHub Actions tab for the "Deploy Website" workflow. Once complete, verify the site loads at `https://stitchuation.app` (after DNS is configured).

**Note for the user:** You need to configure DNS for `stitchuation.app`:
1. Go to your domain registrar
2. Add A records pointing to GitHub Pages IPs:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Optionally add a CNAME for `www` → `enzoaquino.github.io`
4. In GitHub repo Settings → Pages, set custom domain to `stitchuation.app` and enable "Enforce HTTPS"
