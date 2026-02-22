param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

function Assert-GreaterThanZero([double]$Value, [string]$Label) {
    if ($Value -le 0) {
        throw "$Label expected > 0 but got $Value"
    }
    Write-Host "[OK] $Label = $Value"
}

function Assert-Close([double]$Actual, [double]$Expected, [string]$Label) {
    $delta = [Math]::Abs($Actual - $Expected)
    if ($delta -gt 0.01) {
        throw "$Label expected $Expected but got $Actual"
    }
    Write-Host "[OK] $Label = $Actual"
}

Write-Host "Step 1) Reset DB (delete app.db)"
if (Test-Path "app.db") {
    Remove-Item "app.db" -Force
}
Write-Host "[OK] app.db reset"

Write-Host "Step 2) Upload leads CSV"
$tmpDir = Join-Path $PSScriptRoot "tmp_smoke"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$leadsCsv = Join-Path $tmpDir "leads_smoke.csv"
@"
lead_id,status,source,opened_at,updated_at
L1,LAVORATA,FACEBOOK,2026-02-05,2026-02-10
L2,CHIUSA,FACEBOOK,2026-02-08,2026-02-20
L3,NUOVO,GOOGLE,2026-02-11,2026-02-12
"@ | Set-Content -Path $leadsCsv -Encoding utf8
curl.exe -s -X POST -F "file=@$leadsCsv;type=text/csv" "$BaseUrl/api/leads/upload" | Out-Null
Write-Host "[OK] leads uploaded"

Write-Host "Step 3) Create budget: FACEBOOK, Feb 2026, 10000"
$budgetBody = @{
    source = "FACEBOOK"
    campaign_name = ""
    year = 2026
    month = 2
    planned_budget = 10000
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/budgets" -ContentType "application/json" -Body $budgetBody | Out-Null
Write-Host "[OK] budget created"

Write-Host "Step 4) Planned summary must be > 0"
$planned = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/kpi/spend/summary?from=2026-02-01&to=2026-02-28&mode=planned"
Assert-GreaterThanZero -Value ([double]$planned.total_spend) -Label "planned.total_spend"

Write-Host "Step 5) Upload spend CSV + manual spend; verify actual and both"
$spendCsv = Join-Path $tmpDir "spend_smoke.csv"
@"
date,source,campaign,spend
2026-02-15,FACEBOOK,Brand,500.00
2026-02-20,FACEBOOK,Retargeting,700.00
"@ | Set-Content -Path $spendCsv -Encoding utf8
curl.exe -s -X POST -F "file=@$spendCsv;type=text/csv" "$BaseUrl/api/spend/upload" | Out-Null

$manualBody = @{
    date = "2026-02-25"
    source = "FACEBOOK"
    campaign = "Manual Boost"
    spend = 300
    note = "smoke manual"
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/spend/manual" -ContentType "application/json" -Body $manualBody | Out-Null

$actual = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/kpi/spend/summary?from=2026-02-01&to=2026-02-28&mode=actual"
$both = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/kpi/spend/summary?from=2026-02-01&to=2026-02-28&mode=both"

Assert-GreaterThanZero -Value ([double]$actual.total_spend) -Label "actual.total_spend"
Assert-Close -Actual ([double]$both.total_spend) -Expected ([double]$planned.total_spend + [double]$actual.total_spend) -Label "both.total_spend"

Write-Host "Step 6) Verify spend.html shows same totals"
Write-Host "Open: $BaseUrl/static/spend.html"
Write-Host "Set From=2026-02-01 To=2026-02-28 Mode=Both and click Apply."
Write-Host "Expected Total Spend: $($both.total_spend)"

Write-Host ""
Write-Host "Smoke test passed."
