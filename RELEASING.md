# Releasing and rolling back

Every published version of Chomp 3D has a number (v1.0.0, v1.0.1, ...), a tag on GitHub, an entry in
CHANGELOG.md, and a labelled deployment on Cloudflare. The number shows on the About page, so a tester can
say exactly which version they are playing.

## Publish a new version

1. Write what changed under `## Unreleased` in CHANGELOG.md, and commit your work.
2. Start the local server in another terminal: `node serve.mjs`
3. Run one of:

       node tools/release.mjs beta      a beta update      1.0.0-beta.1 -> 1.0.0-beta.2
       node tools/release.mjs patch     a fix              1.0.0 -> 1.0.1   (from a beta: the final 1.0.0)
       node tools/release.mjs minor     something new      1.0.0 -> 1.1.0
       node tools/release.mjs major     a big change       1.0.0 -> 2.0.0

It stops without publishing if anything is uncommitted or any test fails. Otherwise it sets the version,
dates the changelog entry, commits, tags `vX.Y.Z`, pushes both to GitHub, builds the site and publishes it
with the version as the Cloudflare deployment's label. Players with the game open get the "Update ready"
card.

## Something is wrong: undo it

**Fastest (seconds): switch the live site back to an earlier deployment.**

    cd C:\projects\playbutterflyfx
    npx wrangler deployments list          each deployment, with its version label
    npx wrangler rollback                  back to the one before
    npx wrangler rollback <version-id>     or back to a particular one

This changes only what is live. Fix the problem in the code, then release a new patch version.

**Exact: rebuild an earlier version from its GitHub tag.**

    cd C:\projects\chomp-3d
    git worktree add ..\chomp-3d-old v1.0.0          that version's files, beside the real ones
    cd ..\playbutterflyfx
    set CHOMP_DIR=C:\projects\chomp-3d-old && node build.mjs && npx wrangler deploy --tag v1.0.0-again
    cd ..\chomp-3d && git worktree remove ..\chomp-3d-old

**Undo a change in the code itself:** `git revert <commit>` makes a new commit that takes it back out,
keeping the history; then release a patch version.
