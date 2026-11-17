# Contributing

How we work on this repo until the Friday Nov 20 deadline. The plan and today's checklist are in [docs/PLAN.md](docs/PLAN.md); detailed specs are in [docs/SPEC.md](docs/SPEC.md).

## Before you start
Always pull the latest `main` first:

```
git checkout main
git pull origin main
```

## Branches and pull requests
- **Esteban** commits to `main` directly.
- **Everyone else** works on a branch and opens a pull request into `main`:
  ```
  git checkout -b riya/fix-buy-button
  # ...make changes, commit...
  git push -u origin riya/fix-buy-button
  ```
  Then open a pull request on GitHub. Name branches `yourname/short-description`.

## Secrets: never commit them
- Never commit `.env` files, private keys, seed phrases, or API keys. `.gitignore` blocks the common cases, but check `git status` before every commit anyway.
- `.env.example` files hold variable **names only**, with no values. Copy one to `.env` locally and fill it in yourself.
- If you accidentally commit a secret, tell the team right away. The key must be rotated, because deleting it in a later commit does not remove it from git history.

## Wallets
Use **testnet wallets only**: fresh wallets that have never held real funds. Get testnet USDC from https://faucet.circle.com (Arc testnet).

## Commit messages
Say what changed, e.g. `Add use-type picker to clip page` or `Fix price display using 18 decimals instead of 6`. Avoid `fix` or `updates`.

## Reporting bugs
Open a GitHub Issue that includes:
1. Steps to reproduce (page, wallet, what you clicked)
2. What you expected
3. What happened (screenshot, error message, transaction hash if any)
