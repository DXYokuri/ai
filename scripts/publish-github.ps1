param(
  [string]$Repository = 'DXYokuri/ai',
  [string]$Branch = 'main',
  [string]$Message = 'Update solar system atlas'
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$gh = Join-Path $workspace '.tools\gh\bin\gh.exe'
$env:GH_CONFIG_DIR = Join-Path $workspace '.tools\gh-config'
$tempRoot = Join-Path $workspace '.tmp\github-publish'

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Get-ProjectRelativePath([string]$FullName) {
  $workspaceUri = [System.Uri]::new(($workspace.TrimEnd('\') + '\'))
  $fileUri = [System.Uri]::new($FullName)
  return [System.Uri]::UnescapeDataString($workspaceUri.MakeRelativeUri($fileUri).ToString())
}

function Write-JsonPayload([string]$Path, [string]$Json) {
  [System.IO.File]::WriteAllText($Path, $Json, $utf8NoBom)
}

function Invoke-GhJson([string[]]$Arguments) {
  $output = & $gh @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI failed: gh $($Arguments -join ' ')"
  }

  return $output | ConvertFrom-Json
}

$includedFiles = Get-ChildItem -Path $workspace -File -Recurse | Where-Object {
  $relativePath = Get-ProjectRelativePath $_.FullName
  $relativePath -notmatch '^(\.git|\.agents|\.codex|\.tools|\.tmp|node_modules|dist/assets)/' -and
  $relativePath -notin @('dist/index.html', 'tsconfig.app.tsbuildinfo', 'tsconfig.node.tsbuildinfo')
}

$treeEntries = foreach ($file in $includedFiles) {
  $relativePath = Get-ProjectRelativePath $file.FullName
  $blobPayloadPath = Join-Path $tempRoot 'blob.json'
  $blobPayload = @{
    content = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file.FullName))
    encoding = 'base64'
  } | ConvertTo-Json -Compress
  Write-JsonPayload $blobPayloadPath $blobPayload
  $blob = Invoke-GhJson @('api', '--method', 'POST', "repos/$Repository/git/blobs", '--input', $blobPayloadPath)

  @{
    path = $relativePath
    mode = '100644'
    type = 'blob'
    sha = $blob.sha
  }
}

$head = Invoke-GhJson @('api', "repos/$Repository/git/ref/heads/$Branch")
$commit = Invoke-GhJson @('api', "repos/$Repository/git/commits/$($head.object.sha)")
$treePayloadPath = Join-Path $tempRoot 'tree.json'
$treePayload = @{
  base_tree = $commit.tree.sha
  tree = @($treeEntries)
} | ConvertTo-Json -Depth 8 -Compress
Write-JsonPayload $treePayloadPath $treePayload
$tree = Invoke-GhJson @('api', '--method', 'POST', "repos/$Repository/git/trees", '--input', $treePayloadPath)

$commitPayloadPath = Join-Path $tempRoot 'commit.json'
$commitPayload = @{
  message = $Message
  tree = $tree.sha
  parents = @($head.object.sha)
} | ConvertTo-Json -Depth 4 -Compress
Write-JsonPayload $commitPayloadPath $commitPayload
$newCommit = Invoke-GhJson @('api', '--method', 'POST', "repos/$Repository/git/commits", '--input', $commitPayloadPath)

$refPayloadPath = Join-Path $tempRoot 'ref.json'
$refPayload = @{
  sha = $newCommit.sha
  force = $false
} | ConvertTo-Json -Compress
Write-JsonPayload $refPayloadPath $refPayload
$null = Invoke-GhJson @('api', '--method', 'PATCH', "repos/$Repository/git/refs/heads/$Branch", '--input', $refPayloadPath)

Write-Output $newCommit.sha
