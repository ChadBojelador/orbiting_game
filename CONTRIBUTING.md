# Contributing

This workflow is designed for two collaborators. Keep it lightweight while ensuring that meaningful changes receive a second look.

## Initial repository setup

Git and the GitHub repository are initialized. Maintain the following protections:

1. Work from the existing repository; preserve the configured origin and upstream remotes.
2. Use `main` as the protected, releasable branch.
3. Require one approving review for pull requests into `main` when the GitHub plan permits it.
4. Require the `quality` CI check and an up-to-date branch before merging.

## Branching strategy

Use short-lived branches created from an up-to-date `main`. Do not maintain a separate long-lived development branch for the MVP.

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Branch prefixes:

- `feature/...` — new product behavior
- `fix/...` — defect correction
- `refactor/...` — internal change without intended behavior change
- `docs/...` — documentation-only work
- `test/...` — test-only work
- `chore/...` — tooling, dependencies, or maintenance

Examples:

- `feature/fps-match-state-machine`
- `fix/reconnect-dead-player`
- `refactor/spatial-grid-query`
- `docs/local-setup`

Use lowercase, hyphen-separated descriptions. Keep one coherent purpose per branch.

## Commit messages

Use Conventional Commit-style messages:

```text
type(scope): concise imperative summary
```

Examples:

```text
feat(server): enforce arena match deadline
fix(client): reconcile protected player state
test(server): cover score-limit deadline ordering
docs: clarify local database setup
```

Recommended types are `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, and `ci`. Make commits small enough to review and do not mix unrelated formatting with behavioral work.

## Pull request process

1. Confirm the task agrees with `PRD.md` and `ARCHITECTURE.md`.
2. Rebase or merge the latest `main` into the branch before requesting final review.
3. Run relevant tests, lint, type checking, and the build.
4. Open a pull request with:
   - What changed and why
   - Related task or issue
   - Test evidence
   - Screenshots/video for visible changes
   - Risks, assumptions, or follow-up work
5. Assign the other contributor as reviewer.
6. Address feedback with new commits or clearly explained discussion.
7. Resolve all blocking comments and required checks before merge.

Draft pull requests are encouraged for early design feedback.

## Code review expectations

The reviewer should check:

- Product behavior matches the PRD.
- Technical boundaries match the architecture.
- Server authority and input validation are preserved.
- Tests cover important success and failure paths.
- No credentials, unrelated changes, or unnecessary dependencies are included.
- Browser and multiplayer performance implications are reasonable.
- Documentation remains accurate.

The author should respond to every blocking comment. Either apply the change or explain the tradeoff and reach agreement.

## Merge rules

- Avoid directly pushing major changes to `main`.
- Use pull requests for features, fixes, refactors, dependencies, architecture, database migrations, and deployment changes.
- Trivial typo-only changes may be pushed directly only when both contributors agree and branch protection allows it.
- Prefer squash merging so each pull request becomes one coherent commit on `main`.
- Delete the remote feature branch after merge.
- Never merge with failing required checks.
- Never rewrite published `main` history.

## Conflict resolution

1. The branch author incorporates the latest `main`.
2. Resolve conflicts by understanding both changes; do not automatically accept one whole side.
3. Ask the other contributor when intent is unclear.
4. Re-run all affected checks after resolving conflicts.
5. Give extra review attention to conflicts in protocol types, migrations, lockfiles, PRD, architecture, and task tracking.

For `package-lock.json`, first resolve `package.json` intentionally, then regenerate the lockfile with the agreed npm version.

## Testing before merge

At minimum, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Also run `npm run test:e2e` for critical user-flow changes and the appropriate `npm run test:load` scenario for networking, room-state, serialization, or performance-sensitive changes.

If a check cannot run, document the reason and risk in the pull request. The other contributor decides whether that risk is acceptable before merge.

