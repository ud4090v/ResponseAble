# Script to remove cursor_button_icon_replacement.md from commit cee4da8
# This file contains API keys that GitHub push protection is blocking

$repoPath = "c:\VScode\reponseable"

# Get the commit hash
$commitHash = "cee4da8"

# Checkout the commit before the problematic one
git -C $repoPath checkout "$commitHash^"

# Create a new branch
git -C $repoPath checkout -b temp-remove-secrets

# Cherry-pick commits, but skip the problematic file
# First, get list of files changed in cee4da8
$files = git -C $repoPath diff --name-only "$commitHash^" $commitHash

# Remove cursor_button_icon_replacement.md from the list
$filesToKeep = $files | Where-Object { $_ -ne "cursor_button_icon_replacement.md" }

# Checkout files from the commit (except the problematic one)
if ($filesToKeep.Count -gt 0) {
    git -C $repoPath checkout $commitHash -- $filesToKeep
    git -C $repoPath commit -m "chore: remove unused assets and update webpack configuration (secrets removed)"
}

# Cherry-pick subsequent commits
git -C $repoPath cherry-pick 9fa2f7f
git -C $repoPath cherry-pick 537cad4

# Now switch back to main and replace it
git -C $repoPath checkout main
git -C $repoPath reset --hard temp-remove-secrets
git -C $repoPath branch -D temp-remove-secrets

Write-Host "Secrets removed from commit history. You can now push."
