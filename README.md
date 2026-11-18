# Sheet

Find free sheet music for your instrument. Pick an instrument, search for a song or piece, and Sheet searches three free libraries at once, putting scores written or arranged for your instrument first:

- [IMSLP](https://imslp.org/), the Petrucci Music Library
- [The Mutopia Project](https://www.mutopiaproject.org/) (direct PDF and MIDI downloads)
- [The Internet Archive](https://archive.org/details/sheetmusic)'s sheet music scans

It also links to MuseScore, 8notes and a web search for songs the public-domain libraries don't have.

Live at <https://mco.dev/sheet/>.

## How it works

Static HTML, CSS and JavaScript modules, with no build step.

- `instruments.js`: the instruments, the words that identify each one in a score's description, and per-instrument suggestions.
- `app.js`: searching, ranking ("only your instrument", "with your instrument", "the page has an arrangement for it", "other instruments") and rendering.
- The Internet Archive allows cross-origin requests, so the browser searches it directly. IMSLP and Mutopia don't, so the app calls `/api/sheet?src=imslp|mutopia&q=…`, a Netlify function in the mco.dev repo (`netlify/functions/sheet.mjs`) that searches them and returns uniform JSON, cached by the CDN for a day.
- `sw.js`: a network-first service worker so the app installs and opens offline.

## Running locally

Inside an mco.dev checkout (where this repo is the `static/sheet` submodule):

```bash
node dev.mjs
```

Then open <http://localhost:4175/sheet/>. `dev.mjs` serves the static files and answers `/api/sheet` with the Netlify function. Any other static server works too, but then only the Internet Archive is searched.

Icons are rendered from `icons/icon.svg` and `build/icons/full-bleed.svg` with `bash build/icons/render.sh`.

© 2026 Marc Cohen
