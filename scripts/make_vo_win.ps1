#!/usr/bin/env pwsh
<#
.SYNOPSIS
Generate voiceover from full_script.md using Windows built-in TTS (System.Speech.Synthesis).
Creates WAV parts per paragraph/cue, measures durations with ffprobe, writes timings.json + captions.srt,
and concatenates into public/vo/voice.mp3.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Paths
$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
$RootDir = Split-Path $ScriptDir
$ScriptMd = Join-Path $RootDir "vo\full_script.md"
$PartsDir = Join-Path $RootDir "vo\parts"
$OutMp3 = Join-Path $RootDir "public\vo\voice.mp3"
$TimingsJson = Join-Path $RootDir "vo\timings.json"
$CaptionsSrt = Join-Path $RootDir "out\captions.srt"
$ConcatList = Join-Path $PartsDir "concat_list.txt"

# Clean & recreate parts dir
if (Test-Path $PartsDir) { Remove-Item $PartsDir -Recurse -Force }
New-Item -ItemType Directory -Path $PartsDir | Out-Null
if (Test-Path $OutMp3) { Remove-Item $OutMp3 -Force }

# Parse narration paragraphs from full_script.md
$Raw = Get-Content $ScriptMd -Raw

# Extract only the spoken narration lines (skip editor cues starting with "> ")
# The script has a clear pattern: narration paragraphs are plain text, cues start with "> "
# We'll split on blank lines and filter out cues
$Paragraphs = @()
$Current = @()
foreach ($Line in ($Raw -split "`r?`n")) {
    if ($Line.StartsWith("> ")) {
        if ($Current.Count -gt 0) {
            $Paragraphs += $Current -join " "
            $Current = @()
        }
        # Editor cue - skip
    } elseif ($Line.Trim() -eq "") {
        if ($Current.Count -gt 0) {
            $Paragraphs += $Current -join " "
            $Current = @()
        }
    } else {
        $Current += $Line.Trim()
    }
}
if ($Current.Count -gt 0) { $Paragraphs += $Current -join " " }

Write-Host "Found $($Paragraphs.Count) narration paragraphs."

# Initialize TTS
Add-Type -AssemblyName System.Speech
$Synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
# Select female voice
$Synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
# Slightly faster rate
$Synth.Rate = 1

# Generate WAV parts and collect timings
$Timings = @()
$ConcatLines = @()
$Captions = @()
$CumulativeMs = 0
$CueIndex = 0

for ($i = 0; $i -lt $Paragraphs.Count; $i++) {
    $Text = $Paragraphs[$i].Trim()
    if (-not $Text) { continue }

    $CueIndex++
    $PartFile = Join-Path $PartsDir "part_$('{0:D3}' -f $CueIndex).wav"
    Write-Host "[$CueIndex/$($Paragraphs.Count)] Generating: $($Text.Substring(0, [Math]::Min(60, $Text.Length)))..."

    # Synthesize to WAV
    $Synth.SetOutputToWaveFile($PartFile)
    $Synth.Speak($Text)
    $Synth.SetOutputToDefaultAudioDevice() # reset

    # Measure duration with ffprobe
    $DurationSec = (ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $PartFile).Trim()
    $DurationMs = [Math]::Round([double]$DurationSec * 1000)

    # Timings entry
    $Timings += @{
        index = $CueIndex
        text = $Text
        file = $PartFile
        start_ms = $CumulativeMs
        duration_ms = $DurationMs
        end_ms = $CumulativeMs + $DurationMs
    }

    # Concat list entry
    $ConcatLines += "file '$PartFile'"

    # SRT caption entry
    $StartTs = $CumulativeMs / 1000
    $EndTs = ($CumulativeMs + $DurationMs) / 1000
    $Captions += @"
$CueIndex
@($StartTs.ToString("HH\:mm\:ss\,fff") + " --> " + $EndTs.ToString("HH\:mm\:ss\,fff"))
$Text

"@

    $CumulativeMs += $DurationMs
}

# Write timings.json
$Timings | ConvertTo-Json -Depth 5 | Set-Content $TimingsJson -Encoding UTF8
Write-Host "Wrote $TimingsJson"

# Write captions.srt
$Captions -join "`r`n" | Set-Content $CaptionsSrt -Encoding UTF8
Write-Host "Wrote $CaptionsSrt"

# Write concat list
$ConcatLines | Set-Content $ConcatList -Encoding UTF8

# Concatenate all WAV parts into final MP3
Write-Host "Concatenating $($ConcatLines.Count) parts into $OutMp3..."
ffmpeg -f concat -safe 0 -i $ConcatList -c:a libmp3lame -b:a 192k $OutMp3 -y 2>&1 | Out-Null

# Verify
$FinalDur = (ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $OutMp3).Trim()
Write-Host "Voiceover complete: $OutMp3 (Duration: $FinalDur s)"

# Cleanup
$Synth.Dispose()