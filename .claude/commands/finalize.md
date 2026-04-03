You are finalizing the ExPhys LIMS project for deployment. Complete each step in order.

## Step 1 — Update README.md

Read the current README.md and all HTML/JS files that have changed since the last commit (`git diff HEAD --name-only`). Update README.md to accurately reflect:
- The current page list and what each page does
- The current Google Sheet schema (all tabs and their columns)
- Any new features or behaviours added since the last README update
- The usage guide (add, edit, or remove sections as needed)
- The file reference table

Keep the existing structure and tone. Only change what is inaccurate or missing.

## Step 2 — Update CLAUDE.md

Read the current CLAUDE.md. Update it to accurately reflect the current state of the codebase:
- File structure table
- Google Sheet schema (all 7 tabs)
- Key Behaviours section
- API action list (getAll, getConsumables, etc.)
- Shared utilities table
- Settings page pattern
- Any architectural notes that have changed

Keep all existing sections. Only update what has changed.

## Step 3 — Commit

Stage all modified tracked files (do not use `git add -A` — add each file by name after reviewing `git status`). Do not stage `deploy/` or any untracked files that shouldn't be committed.

Write a clear commit message summarizing what changed since the last commit. Follow the existing commit message style in `git log --oneline -5`.

## Step 4 — Build deploy folder

Run `bash build.sh` to regenerate the `deploy/` folder with the latest files.

## Step 5 — Push to GitHub

Run `git push origin master`.

Report what was done at each step.
