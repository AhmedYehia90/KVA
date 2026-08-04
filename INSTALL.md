# Install KVA Foundation Pack v1.1

1. Extract the ZIP.
2. Copy all files and folders into the repository root.
3. Allow `README.md` to replace the existing root README.
4. Review changes:

```powershell
git status
git diff --stat
```

5. Commit:

```powershell
git add README.md CONTRIBUTING.md CHANGELOG.md PROJECT_BOARD.md docs .github
git commit -m "docs: add KVA foundation pack v1.1"
git push origin main
```

This pack does not modify application runtime code, dependencies, database migrations, or environment files.
