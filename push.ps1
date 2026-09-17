param(
  [string]$Message = "Update from local",
  [string]$Remote = "origin"
)

$Branch = git branch --show-current
if (-not $Branch) { throw "Not on a branch" }

git add -A
if ($LASTEXITCODE -ne 0) { throw "git add failed" }

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Nothing new to commit."
} else {
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
}

git push $Remote $Branch
if ($LASTEXITCODE -ne 0) { throw "Push failed" }
Write-Host "Pushed '$Branch' to '$Remote'."