# Boss artwork audit

All 59 bosses have explicit folder mappings in `src/bossArtwork.ts`, shared by the Standard and Freestyle ladders.
59 bosses currently have PNG artwork. Every existing character folder is assigned to a boss.

## Missing folders

None.

## Existing folders without PNG artwork

These mappings are valid, but the folders have no images to display. The app uses its mascot fallback until artwork is supplied.

None.

## Verification

Run `node boss-artwork-check.mjs` to audit mappings and image paths. Add `--write` to refresh this report.
