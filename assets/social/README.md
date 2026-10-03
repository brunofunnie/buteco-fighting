# Social covers

- `buteco-fighting-og.png`: 1200 × 630, Open Graph.
- `buteco-fighting-twitter.png`: 1200 × 675, Twitter/X large card.
- `buteco-fighting-square.png`: 1200 × 1200, square sharing artwork.

All variants reuse the current illustrated crowd, illustrated Devon and original Buteco Fighting and Buteco Games logo files. The tagline is rendered separately. There are no menu buttons or game HUD elements.

Regenerate with `npm run social:build`. The layout is in `tools/social-cover.html`; the renderer starts a temporary local HTTP server and validates image loading, safe branding margins and PNG dimensions. No external fonts, image generation or API calls are required.

Open Graph and Twitter metadata in `index.html` use the corresponding horizontal variants with a versioned URL to distinguish the updated artwork from the previous cover.
