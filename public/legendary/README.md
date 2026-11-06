# Legendary matches archive

Source: [PGN Mentor free event downloads](https://www.pgnmentor.com/files.html), imported November 6, 2026.

This snapshot contains 87,407 games across all 982 event files listed by the source, spanning 1851–2024. It is a broad tournament and championship archive, not a claim to contain every historic chess game. The three previously featured classics remain separately available on the Legendary matches page.

Only factual headers and mainline moves are included. Source commentary and variations are omitted. Every imported mainline was replayed and checked for legal moves with chessops; 27 unplayed or invalid records were excluded and are listed in `import-report.json`. Original results, dates and source metadata are preserved; missing ratings and move times are not invented.

`catalog.json` contains tournament metadata and player names. Each tournament's games and PGNs live in its own JSON file. The app loads these files on demand and displays 24 cards per page. No archive requests are made on home or personal Game history.

Run `npm run import:legendary` from the project root to refresh the archive. The importer caches raw source downloads under ignored `.tmp/legendary-pgn/`; remove individual cached files before refreshing corrected upstream scores. Stable game IDs are derived from the normalized PGN. Review the import report before committing a refresh. Source download links remain visible on the archive and replay pages.
