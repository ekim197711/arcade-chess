# Boss artwork audit

All 59 bosses have explicit folder mappings in `src/bossArtwork.ts`, shared by the Standard and Freestyle ladders.
47 bosses currently have PNG artwork. Every existing character folder is assigned to a boss.

## Missing folders

None.

## Existing folders without PNG artwork

These mappings are valid, but the folders have no images to display. The app uses its mascot fallback until artwork is supplied.

- Checkpoint Celine: `checkpoint-celine`
- Clockwork Cormac: `clockwork-cormac`
- Mate-in-One Marnie: `mate-in-one-marnie`
- Endboss Evelyn: `endboss-evelyn`
- Crowncrusher Clara: `crowncrusher-clara`
- Royal Rumble Rafi: `royal-rumble-rafi`
- Check Raid Ramon: `check-raid-ramon`
- Mate Collector Mabel: `mate-collector-mabel`
- Fortress Fiona: `fortress-fiona`
- Tournament Titan Toby: `tournament-titan-toby`
- Matchpoint Max: `matchpoint-max`
- Checkmate Cindy: `checkmate-cindy`

## Verification

Run `node boss-artwork-check.mjs` to audit mappings and image paths. Add `--write` to refresh this report.
