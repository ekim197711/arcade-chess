param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $ProjectRoot 'public/characters'
$outputRoot = Join-Path $ProjectRoot 'public/boss-thumbnails'
$count = 0
foreach ($folder in Get-ChildItem -LiteralPath $assetRoot -Directory) {
    $pictures = @(Get-ChildItem -LiteralPath $folder.FullName -Filter '*.png' -File)
    if (!$pictures.Count) { continue }
    $fallback = @('focused', 'taunting', 'angry', 'won', 'lost') | Where-Object { $pictures.BaseName -contains $_ } | Select-Object -First 1
    if (!$fallback) { $fallback = $pictures[0].BaseName }
    $selected = @('focused', 'taunting') | ForEach-Object { if ($pictures.BaseName -contains $_) { $_ } else { $fallback } } | Select-Object -Unique
    $destination = Join-Path $outputRoot $folder.Name
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    foreach ($expression in $selected) {
        $sourceImage = [System.Drawing.Image]::FromFile((Join-Path $folder.FullName "$expression.png"))
        $bitmap = [System.Drawing.Bitmap]::new(112, 112, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $scale = [Math]::Min(112 / $sourceImage.Width, 112 / $sourceImage.Height)
            $width = [int][Math]::Round($sourceImage.Width * $scale)
            $height = [int][Math]::Round($sourceImage.Height * $scale)
            $graphics.DrawImage($sourceImage, [int]((112 - $width) / 2), [int]((112 - $height) / 2), $width, $height)
            $bitmap.Save((Join-Path $destination "$expression.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            $count++
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
            $sourceImage.Dispose()
        }
    }
}
Write-Output "Generated $count portraits at 112x112 pixels."
