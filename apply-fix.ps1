$ErrorActionPreference = "Stop"

$files = @(
  @{ Path = "apps/web/messages/en.json"; Value = "Submitted" },
  @{ Path = "apps/web/messages/ar.json"; Value = "تم الإرسال" }
)

foreach ($item in $files) {
  $fullPath = Join-Path (Get-Location) $item.Path

  if (-not (Test-Path $fullPath)) {
    throw "File not found: $fullPath"
  }

  $json = Get-Content $fullPath -Raw | ConvertFrom-Json

  if (-not $json.PilotDashboard.statuses) {
    throw "PilotDashboard.statuses not found in $($item.Path)"
  }

  $json.PilotDashboard.statuses | Add-Member `
    -NotePropertyName "submitted" `
    -NotePropertyValue $item.Value `
    -Force

  $json |
    ConvertTo-Json -Depth 100 |
    Set-Content -Path $fullPath -Encoding utf8
}

Write-Host "Translation key PilotDashboard.statuses.submitted added successfully."
