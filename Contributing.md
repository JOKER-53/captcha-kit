# Contributing to captcha-kit

Thanks for your interest in improving captcha-kit! This document covers how to set up the project, our conventions, and how to submit changes.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/captcha-kit.git
   cd captcha-kit
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Project Structure

```
captcha-kit/
├── packages/
│   ├── core/          # Shared logic, types, validation
│   ├── text/
│   ├── math/
│   ├── image-select/
│   ├── slider/
│   ├── rotate/
│   ├── odd-one-out/
│   ├── drag-drop/
│   └── behavioral/
├── frontend/           # Vanilla JS components
├── examples/
└── docs/
```

Each challenge type lives in its own package under `packages/` and implements the shared `Challenge` interface from `packages/core`.

## Development Workflow

- Run tests: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`

## Adding a New Challenge Module

1. Create a new folder under `packages/<your-module>`
2. Implement the `Challenge` interface (generate, serialize, validate)
3. Add a frontend component under `frontend/`
4. Add a demo under `examples/`
5. Write tests (Vitest)
6. Update the module table in `README.md`

## Coding Standards

- TypeScript for all new code
- ESLint + Prettier — run `npm run lint:fix` before committing
- Keep modules dependency-light
- **Never trust the client** — all validation logic must be enforceable server-side
- Every challenge must implement token expiration

## Commit Messages

Use clear, conventional commit style where possible:

```
feat(math): add configurable difficulty levels
fix(core): correct token expiry edge case
docs(readme): update installation instructions
```

## Submitting a Pull Request

1. Ensure tests pass and lint is clean
2. Update relevant documentation
3. Fill out the PR template completely
4. Link any related issues
5. One logical change per PR — keep PRs focused and reviewable

## Reporting Bugs

Use the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.md). For security vulnerabilities, see [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## Code of Conduct

Be respectful, constructive, and patient. This is a community project — assume good intent and help newcomers get oriented.

## Questions?

Open a [Discussion](../../discussions) or an issue tagged `question`.
