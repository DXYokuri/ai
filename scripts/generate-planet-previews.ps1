Add-Type -AssemblyName System.Drawing

$sourceDir = Join-Path $PSScriptRoot '..\public\textures\planets'
$outputDir = Join-Path $sourceDir 'preview'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$files = @(
  'sun.jpg',
  'mercury.jpg',
  'venus-surface.jpg',
  'earth-color.jpg',
  'mars.jpg',
  'jupiter.jpg',
  'saturn.jpg',
  'uranus.jpg',
  'neptune.jpg'
)

foreach ($filename in $files) {
  $source = Join-Path $sourceDir $filename
  $target = Join-Path $outputDir $filename
  $image = [System.Drawing.Image]::FromFile($source)
  $width = [Math]::Min(768, $image.Width)
  $height = [Math]::Round($image.Height * ($width / $image.Width))
  $preview = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($preview)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($image, 0, 0, $width, $height)
  $preview.Save($target, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $graphics.Dispose()
  $preview.Dispose()
  $image.Dispose()
}
