<#
.SYNOPSIS
    Sample the Private Working Set (PWS) of the Activity Tracker app, its own
    WebView2 process tree, and (separately) session-wide WebView2 processes not
    owned by the app; append one timestamped row to a CSV.

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

    WebView2 attribution is scoped to the app's own process tree: each
    msedgewebview2.exe process is walked up its ParentProcessId chain (max 6
    hops; the walk stops if a parent has already exited) and counted as
    "owned" only when an app candidate is an ancestor. Remaining session-wide
    msedgewebview2.exe processes (SearchHost, Widgets, or any other WebView2
    app) are reported separately in the other_* columns so the contamination
    stays visible but is excluded from the totals.

    If the app is not running, a graceful all-zero row is appended instead of
    erroring (owned/other webview2 columns are zero too, per protocol).

    Private Working Set is read from the "\Process(*)\Working Set - Private"
    performance counter and matched to processes by PID (counter instance names
    are truncated/unreliable for long process names like "Activity Tracker v2").

.PARAMETER OutFile
    CSV file to append to. Defaults to "<this script dir>\mem-samples.csv".
    The header is auto-created on first use:
    timestamp,app_exe_name,app_pws_mb,owned_webview2_count,owned_webview2_pws_mb,total_pws_mb,other_webview2_count,other_webview2_pws_mb

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mem-snapshot.ps1
#>
param(
    [string]$OutFile = (Join-Path $PSScriptRoot "mem-samples.csv")
)

$ErrorActionPreference = "Stop"

$AppCandidates = @("Activity Tracker v2", "activity-tracker-v2", "activity_tracker_v2")
$WebView2Name   = "msedgewebview2"
$MaxParentHops  = 6

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

function Get-PwsBytes {
    <#
    Private working set bytes for one PID from the perf-counter map, falling
    back to WorkingSet64 (total working set) when the PID is missing (process
    exited mid-sample, or counters unavailable). 0.0 if the PID is gone from
    both views.
    #>
    param([long]$Id, $Map, $Ws64ById)
    if ($null -ne $Map -and $Map.ContainsKey($Id)) { return [double]$Map[$Id] }
    if ($null -ne $Ws64ById -and $Ws64ById.ContainsKey($Id)) { return [double]$Ws64ById[$Id] }
    return 0.0
}

function Test-WebView2OwnedByApp {
    <#
    Walks $ProcessId's ParentProcessId chain up to $MaxParentHops hops and
    returns $true iff an app candidate PID is an ancestor. Stops and returns
    $false if an ancestor is missing from $ParentMap (parent already exited)
    or the hop budget is exhausted.
    #>
    param([long]$ProcessId, $ParentMap, $AppPids)
    $current = $ProcessId
    for ($hop = 0; $hop -lt $MaxParentHops; $hop++) {
        if (-not $ParentMap.ContainsKey($current)) { return $false }  # exited parent
        $parent = $ParentMap[$current]
        if ($AppPids.Contains($parent)) { return $true }
        $current = $parent
    }
    return $false
}

function Write-MemSnapshot {
    param([string]$Path)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $fmt = { param($v) ([double]$v).ToString("0.0", $inv) }

    # Census: one CIM pass gives PID + ParentProcessId for every live process.
    $allProcs = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    $parentMap  = @{}
    $procById   = @{}
    $appPids    = [System.Collections.Generic.HashSet[long]]::new()
    $appPidList = [System.Collections.Generic.List[long]]::new()
    $wv2Pids    = [System.Collections.Generic.List[long]]::new()
    foreach ($p in $allProcs) {
        $procId = [long]$p.ProcessId
        $name = [string]$p.Name
        $parentMap[$procId] = [long]$p.ParentProcessId
        $procById[$procId] = $p
        foreach ($c in $AppCandidates) {
            if ($name -eq ($c + ".exe")) {
                if (-not $appPids.Contains($procId)) {
                    [void]$appPids.Add($procId)
                    [void]$appPidList.Add($procId)
                }
                break
            }
        }
        if ($name -eq ($WebView2Name + ".exe")) { [void]$wv2Pids.Add($procId) }
    }

    # WorkingSet64 fallback snapshot for PIDs missing from the perf map.
    $ws64ById = @{}
    foreach ($p in @(Get-Process -ErrorAction SilentlyContinue)) {
        $ws64ById[[long]$p.Id] = [double]$p.WorkingSet64
    }

    $map = Get-PrivateWorkingSetMap
    if ($null -eq $map) {
        Write-Warning "perf counter unavailable; falling back to WorkingSet64 (total, not private)"
    }

    if ($appPidList.Count -eq 0) {
        # App not running: graceful zero row, still exit 0.
        $appName    = "not_running"
        $appMb      = 0.0
        $ownedCount = 0
        $ownedMb    = 0.0
        $otherCount = 0
        $otherMb    = 0.0
    } else {
        $appName = (($procById[$appPidList[0]].Name) -replace '\.exe$', '')

        $appMb = 0.0
        foreach ($ap in $appPidList) { $appMb += Get-PwsBytes -Id $ap -Map $map -Ws64ById $ws64ById }
        $appMb = $appMb / 1MB

        $ownedCount = 0; $ownedMb = 0.0
        $otherCount = 0; $otherMb = 0.0
        foreach ($w in $wv2Pids) {
            $mb = (Get-PwsBytes -Id $w -Map $map -Ws64ById $ws64ById) / 1MB
            if (Test-WebView2OwnedByApp -ProcessId $w -ParentMap $parentMap -AppPids $appPids) {
                $ownedCount++
                $ownedMb += $mb
            } else {
                $otherCount++
                $otherMb += $mb
            }
        }
    }
    $totalMb = $appMb + $ownedMb

    $header = "timestamp,app_exe_name,app_pws_mb,owned_webview2_count,owned_webview2_pws_mb,total_pws_mb,other_webview2_count,other_webview2_pws_mb"
    if (-not (Test-Path -LiteralPath $Path)) {
        Add-Content -LiteralPath $Path -Value $header -Encoding UTF8
    }
    $row = "{0},{1},{2},{3},{4},{5},{6},{7}" -f $timestamp, $appName, (& $fmt $appMb), $ownedCount, (& $fmt $ownedMb), (& $fmt $totalMb), $otherCount, (& $fmt $otherMb)
    Add-Content -LiteralPath $Path -Value $row -Encoding UTF8

    Write-Host ("mem-snapshot: {0} app={1} app_pws_mb={2} owned_webview2_count={3} owned_webview2_pws_mb={4} total_pws_mb={5} other_webview2_count={6} other_webview2_pws_mb={7} -> {8}" -f `
        $timestamp, $appName, (& $fmt $appMb), $ownedCount, (& $fmt $ownedMb), (& $fmt $totalMb), $otherCount, (& $fmt $otherMb), $Path)
}

# Auto-run on direct execution (also when invoked via & from mem-soak.ps1).
Write-MemSnapshot -Path $OutFile
