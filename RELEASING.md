# Releasing

Pushing a tag is the whole release process. Two products, two tag lines, two
independent version numbers.

| Tag you push | What gets built | Where it lands |
|---|---|---|
| `desktop-v2.1.0` | Installer, portable exe, `latest.yml`, blockmap | Draft release **Desktop v2.1.0** |
| `cli-v1.6.0` | One console exe | Draft release **CLI v1.6.0** |

```bash
git tag desktop-v2.1.0 && git push origin desktop-v2.1.0
git tag cli-v1.6.0     && git push origin cli-v1.6.0
```

You do not edit a version number by hand. The tag is the version: the workflow
stamps it into `desktop/package.json` or `source/converter.py` for that build
only, and never commits it back.

## Nothing ships until you publish the draft

Every release is created as a **draft**. Drafts are invisible to
`/releases/latest`, which is exactly where the desktop app looks for updates —
so a draft reaches nobody. Read the generated notes, fix what's wrong, then hit
**Publish release**. That is the moment the update goes out to every installed
copy.

## The one rule that will bite you

**Never mark a CLI release as "Latest".**

GitHub keeps a single "latest release" per repository. `electron-updater` asks
for `/releases/latest`, then downloads `latest.yml` from whatever tag it names.
A CLI release in that slot has no `latest.yml`, so the desktop app's updater
fails with `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND` — for everyone, until the next
desktop release takes the slot back.

Two things guard against this, so you'd have to work at it to break it:

- `release-cli.yml` creates the draft with `--latest=false`.
- `release-guard.yml` re-applies `make_latest=false` whenever a `cli-*` release
  is published or edited, including from the web UI.

If you publish a CLI release through the web interface, leave **Set as the
latest release** unchecked anyway. The guard will fix it either way, but there's
no reason to make it work.

## Dry runs

Both workflows accept `workflow_dispatch` with a version input. That path builds
everything and uploads the results as workflow artifacts **without** creating a
release or a tag — use it to check a build before committing to a version.

## What the desktop workflow guarantees

The job fails rather than publishing an incomplete release if `latest.yml`, the
installer or the portable exe is missing. A release without `latest.yml` would
silently cut off every installed app from future updates, so it is better to
have no release at all.

## Versioning

Both lines follow semver. They are unrelated — the desktop app is at 2.x because
it is a newer product, not because the CLI is behind. Release either one without
touching the other.

Prerelease tags (`desktop-v2.1.0-beta.1`) build and produce a draft like any
other, but the stable channel ignores prerelease versions, so beta users would
need an opt-in that does not exist yet.

## What has been verified

The update path was exercised end to end against a local feed before any of this
went near GitHub: an installed 2.0.0 detected 2.0.1, downloaded it differentially
using the blockmap, showed the dot and the card, restarted, and came back up as
2.0.1 with settings and FFmpeg intact. The portable guard, the dev-mode skip and
the CLI build were tested the same way.

Two steps can only be proven on GitHub itself, and are worth watching the first
time: a `workflow_dispatch` dry run of each workflow, and the first real tag.

## Code signing

Neither build is signed. Windows SmartScreen warns on first run, and that is
expected. Auto-update still works: `electron-updater` verifies the download
against the SHA512 in `latest.yml`, which does not depend on a signature.
