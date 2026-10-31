<#
.SYNOPSIS
    Soak-test memory sampler: repeatedly snapshots app + WebView2 Private
    Working Set and appends rows to a CSV.

.DESCRIPTION
    Calls scripts\mem-snapshot.ps1 every -IntervalSeconds for -DurationMinutes,
    printing a progress line per sample. Rows accumulate in the same CSV used
    by the one-shot script (mem-samples.csv), so soak runs interleave cleanly
    with manual checkpoint snapshots.

.PARAMETER IntervalSeconds
    Seconds between samples. Default 30. Minimum 1.

.PARAMETER DurationMinutes
    Total soak duration in minutes. Default 60.

.PARAMETER OutFile
    CSV path. Default "scripts\mem-samples.csv", resolved relative to the repo
    root (parent of the scripts dir) so the default works from any cwd.

.PARAMETER State
    Label recorded for every sample in this run (default "soak"). Soak rows must be
    distinguishable from one-shot checkpoint rows in the same CSV.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-soak.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-soak.ps1 -IntervalSeconds 10 -DurationMinutes 5
#>
param(
    [int]$IntervalSeconds = 30,
    [int]$DurationMinutes = 60,
    [string]$OutFile = "scripts\mem-samples.csv",
    [string]$State = "soak"
)

$ErrorActionPreference = "Stop"
if ($IntervalSeconds -lt 1) { $IntervalSeconds = 1 }
if ($DurationMinutes -lt 1) { $DurationMinutes = 1 }

$scriptDir   = $PSScriptRoot
$repoRoot    = Split-Path -Parent $scriptDir
$snapshotScript = Join-Path $scriptDir "mem-snapshot.ps1"

if (-not [System.IO.Path]::IsPathRooted($OutFile)) {
    $OutFile = Join-Path $repoRoot $OutFile
}

$totalSamples = [int][math]::Ceiling(($DurationMinutes * 60) / $IntervalSeconds)
$endTime = (Get-Date).AddMinutes($DurationMinutes)
$sample = 0

Write-Host ("mem-soak: interval={0}s duration={1}min (~{2} samples) -> {3}" -f $IntervalSeconds, $DurationMinutes, $totalSamples, $OutFile)

while ((Get-Date) -lt $endTime) {
    $sample++
    Write-Host ("[soak {0}/{1} @ {2}]" -f $sample, $totalSamples, (Get-Date -Format "HH:mm:ss"))
    & $snapshotScript -OutFile $OutFile -State $State
    if ((Get-Date) -ge $endTime) { break }
    Start-Sleep -Seconds $IntervalSeconds
}

Write-Host ("mem-soak complete: {0} samples appended to {1}" -f $sample, $OutFile)
