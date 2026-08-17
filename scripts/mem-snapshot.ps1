<#
.SYNOPSIS
    Sample the Private Working Set (PWS) of the Activity Tracker app and all
    msedgewebview2.exe processes; append one timestamped row to a CSV.

.DESCRIPTION
    Phase 0 of the memory-optimization plan
    (.hermes/plans/2026-08-17_133000-memory-leak-review-optimization.md).

    Process names matched (verified against repo config):
      - "Activity Tracker v2"  -> tauri.conf.json "productName"; Tauri v2 bundles
                                  the main binary under the productName, so the
                                  installed/package exe is "Activity Tracker v2.exe".
      - "activity-tracker-v2"  -> Cargo.toml [package] name; dev builds
                                  (cargo run / tauri dev) produce this .exe.
      - "activity_tracker_v2"  -> belt-and-braces (Cargo underscore normalization).
    All msedgewebview2.exe processes are summed (any WebView2 host in the session;
    note that other WebView2 apps would be counted too).

    If the app is not running, a graceful all-zero row is appended instead of
    erroring (webview2 columns are zero too, per protocol).

    Private Working Set is read from the "\Process(*)\Working Set - Private"
    performance counter and matched to processes by PID (counter instance names
    are truncated/unreliable for long process names like "Activity Tracker v2").

.PARAMETER OutFile
    CSV file to append to. Defaults to "<this script dir>\mem-samples.csv".
    The header is auto-created on first use:
    timestamp,app_exe_name,app_pws_mb,webview2_count,webview2_pws_mb,total_pws_mb

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-snapshot.ps1
#>
param(
    [string]$OutFile = (Join-Path $PSScriptRoot "mem-samples.csv")
)

$ErrorActionPreference = "Stop"

$AppCandidates = @("Activity Tracker v2", "activity-tracker-v2", "activity_tracker_v2")
$WebView2Name   = "msedgewebview2"

function Get-PrivateWorkingSetMap {
    <#
    Returns @{ PID = private working set bytes } for every live process, read
    from the "Working Set - Private" performance counter and paired with the
    "ID Process" counter of the same instance. Returns $null on persistent
    failure so the caller can fall back to Get-Process.WorkingSet64.
    #>
    $paths = @("\Process(*)\ID Process", "\Process(*)\Working Set - Private")
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try {
            $samples = Get-Counter -Counter $paths -ErrorAction Stop
            $ids = @{}
            $ws = @{}
            foreach ($s in $samples.CounterSamples) {
                if ($s.Path -match '\\process\(([^)]*)\)\\id process$') {
                    $ids[$Matches[1]] = [long]$s.CookedValue
                } elseif ($s.Path -match '\\process\(([^)]*)\)\\working set - private$') {
                    $ws[$Matches[1]] = [double]$s.CookedValue
                }
            }
            $map = @{}
            foreach ($instance in $ids.Keys) {
                if ($ws.ContainsKey($instance)) {
                    $map[$ids[$instance]] = $ws[$instance]
                }
            }
            return $map
        } catch {
            if ($attempt -eq 2) { return $null }
            Start-Sleep -Milliseconds 250
        }
    }
}

function Get-ProcessPws {
    <#
    Sum of private working set bytes for one or more Process objects.
    Falls back to WorkingSet64 (total working set) for any PID missing from the
    perf-counter map (process exited mid-sample, or counters unavailable).
    #>
    param($Process, $Map)
    $total = 0.0
    foreach ($p in @($Process)) {
        $id = [long]$p.Id
        if ($null -ne $Map -and $Map.ContainsKey($id)) {
            $total += [double]$Map[$id]
        } else {
            try { $total += [double]$p.WorkingSet64 } catch { }
        }
    }
    return $total
}

function Write-MemSnapshot {
    param([string]$Path)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $fmt = { param($v) ([double]$v).ToString("0.0", $inv) }

    $appProcs = @(Get-Process -Name $AppCandidates -ErrorAction SilentlyContinue)
    $map = Get-PrivateWorkingSetMap
    if ($null -eq $map) {
        Write-Warning "perf counter unavailable; falling back to WorkingSet64 (total, not private)"
    }

    if ($appProcs.Count -eq 0) {
        # App not running: graceful zero row, still exit 0.
        $appName   = "not_running"
        $appMb     = 0.0
        $wv2Count  = 0
        $wv2Mb     = 0.0
    } else {
        $appName  = $appProcs[0].ProcessName
        $appMb    = (Get-ProcessPws -Process $appProcs -Map $map) / 1MB

        $wv2Procs = @(Get-Process -Name $WebView2Name -ErrorAction SilentlyContinue)
        $wv2Count = $wv2Procs.Count
        $wv2Mb    = (Get-ProcessPws -Process $wv2Procs -Map $map) / 1MB
    }
    $totalMb = $appMb + $wv2Mb

    $header = "timestamp,app_exe_name,app_pws_mb,webview2_count,webview2_pws_mb,total_pws_mb"
    if (-not (Test-Path -LiteralPath $Path)) {
        Add-Content -LiteralPath $Path -Value $header -Encoding UTF8
    }
    $row = "{0},{1},{2},{3},{4},{5}" -f $timestamp, $appName, (& $fmt $appMb), $wv2Count, (& $fmt $wv2Mb), (& $fmt $totalMb)
    Add-Content -LiteralPath $Path -Value $row -Encoding UTF8

    Write-Host ("mem-snapshot: {0} app={1} app_pws_mb={2} webview2_count={3} webview2_pws_mb={4} total_pws_mb={5} -> {6}" -f `
        $timestamp, $appName, (& $fmt $appMb), $wv2Count, (& $fmt $wv2Mb), (& $fmt $totalMb), $Path)
}

# Auto-run on direct execution (also when invoked via & from mem-soak.ps1).
Write-MemSnapshot -Path $OutFile
