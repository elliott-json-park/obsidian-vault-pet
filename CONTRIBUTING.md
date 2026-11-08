# Contributing

Bug reports, feature requests and pull requests are all welcome. This file is
the short version of what will make any of them go smoothly.

## Reporting a bug

Open an issue at
[github.com/elliott-json-park/obsidian-vault-pet/issues](https://github.com/elliott-json-park/obsidian-vault-pet/issues),
or press **Send feedback** in the plugin's settings, which opens the same page.

The useful things are: your Obsidian version, your OS, the plugin version,
what the cat or the house was doing, and what you did immediately before it
happened. For anything about coins, XP, streaks or the shop, say roughly what
the numbers were before and after — those bugs are almost impossible to
reproduce from "it went wrong".

## Suggesting a feature

Say what you were trying to do, not only what you would like added. Costumes,
toys and quests that fit the cat's world are especially welcome as ideas.

Three things are deliberately out of scope, so it saves time to say so:

- **Anything that reaches the network.** The plugin makes no network requests
  at all and only reads notes; see the Privacy section of the README.
- **Ways to earn without writing.** Only real new writing counts — pasting,
  retyping and restoring deleted notes earn nothing. A change that lets them
  count will not be merged.
- **Mobile.** Petting, dragging and right-clicking the cat are most of the
  point, so the manifest says `isDesktopOnly`.

## Pull requests

### How the code is laid out

- `src/core/` — the logic (writing stats, growth, coins, goals, quests,
  badges), plain CommonJS with no Obsidian dependency.
- `src/plugin/` — the Obsidian side, and `src/plugin/styles.css`.
- `src/kit/` — the cat and house renderer shared with the desktop app
  KitCommit. It is loaded into an iframe at runtime.

`main.js` and `styles.css` in the repository root are build output. Edit the
files under `src/`, then rebuild.

### Setting up

There are no npm dependencies; Node is enough.

```bash
node scripts/build.js   # bundle src/ into main.js, copy styles.css
node tests/run.js       # logic tests against a fake obsidian module
```

### Before you open the PR

1. **`node tests/run.js` passes.**
2. **You rebuilt and committed `main.js` and `styles.css`.** The release
   workflow ships the committed files as they are, so a source change without
   a rebuild never reaches users.
3. **New text exists in every language.** The interface is in English, Korean
   and Chinese; add your strings to the i18n files in `src/kit/` for all three.
   A machine translation is fine as a start — say so in the PR.

### Commit messages

A sentence in the imperative that says what the change does for the user:
"Keep the streak when the day's goal is met after midnight". Not "fix bug".

## Releases

Maintainer only. Bump `manifest.json` and `versions.json`, rebuild, commit,
then `git tag <version> && git push origin <version>`. The workflow in
`.github/workflows/release.yml` checks that the tag matches `manifest.json`,
attaches `main.js`, `manifest.json` and `styles.css`, and mints a provenance
attestation so anyone can verify with `gh attestation verify` that the assets
came from this repository.

## License

By contributing you agree that your contribution is licensed under the MIT
licence, the same as the rest of the project. See [LICENSE](LICENSE).
