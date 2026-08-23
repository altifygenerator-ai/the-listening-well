# Throw a Penny v1.7.3

## Response-system repair

This build fixes the repeated generic response shown by older releases.

- Retired canned v1.7.1 answers are filtered out of local and cloud journal sync.
- Normal wish responses require a matching v1.7.3 client/server response version.
- The client and API perform a build-version handshake before wishes can be submitted.
- If an installed PWA is stale, the client clears the old service worker/cache once and reloads.
- `app.js` and `styles.css` are versioned in the page URL to prevent stale asset reuse.
- The AI instruction was simplified so the first sentence must address the actual subject/outcome of the wish.
- Generic philosophical openings are rejected.
- The response validator now requires the main `answer` itself, not a hidden secondary field, to stay anchored to the user's words.
- If a draft is still generic after one rewrite, it is not shown and the penny is returned.

No Stripe price changes or new Supabase migration are required.

After deployment, do one hard refresh. Existing retired generic answers remain in the database for historical integrity but are no longer imported or displayed by this client.
