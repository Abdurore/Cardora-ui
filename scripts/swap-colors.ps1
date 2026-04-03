$cssPath = Join-Path $PSScriptRoot '..\src\App.css'
$c = [System.IO.File]::ReadAllText($cssPath)

# Aurora: warm ambers -> mint greens
$c = $c.Replace('rgba(255, 175, 80, 0.0)', 'rgba(98, 255, 162, 0.0)')
$c = $c.Replace('rgba(255, 195, 100, 0.22)', 'rgba(126, 247, 200, 0.22)')
$c = $c.Replace('rgba(255, 155, 60, 0.18)', 'rgba(80, 220, 160, 0.18)')
$c = $c.Replace('rgba(210, 120, 60, 0.06)', 'rgba(60, 200, 150, 0.06)')
$c = $c.Replace('rgba(255, 220, 150, 0.24)', 'rgba(140, 255, 200, 0.24)')

# Halo
$c = $c.Replace('rgba(255, 195, 100, 0.3)', 'rgba(126, 247, 200, 0.3)')
$c = $c.Replace('rgba(255, 155, 60, 0.08)', 'rgba(80, 220, 160, 0.08)')

# Floating card border & shadows
$c = $c.Replace('rgba(255, 195, 100, 0.28)', 'rgba(98, 255, 162, 0.28)')
$c = $c.Replace('rgba(255, 175, 80, 0.08)', 'rgba(98, 255, 162, 0.08)')
$c = $c.Replace('rgba(255, 220, 170, 0.08)', 'rgba(140, 255, 200, 0.08)')

# Card text colors
$c = $c.Replace('rgba(255, 195, 120, 0.65)', 'rgba(160, 247, 200, 0.65)')
$c = $c.Replace('rgba(255, 240, 220, 0.92)', 'rgba(220, 255, 240, 0.92)')

# Shimmer
$c = $c.Replace('rgba(255, 220, 160, 0.12)', 'rgba(160, 255, 210, 0.12)')
$c = $c.Replace('rgba(255, 220, 160, 0.18)', 'rgba(160, 255, 210, 0.18)')

# Card lines
$c = $c.Replace('rgba(255, 195, 120, 0.12)', 'rgba(126, 247, 200, 0.12)')

# Dust particles
$c = $c.Replace('rgba(255, 210, 140, 0.9)', 'rgba(140, 255, 200, 0.9)')
$c = $c.Replace('rgba(255, 175, 80, 0.2)', 'rgba(98, 255, 162, 0.2)')
$c = $c.Replace('rgba(255, 195, 100, 0.3)', 'rgba(126, 247, 200, 0.3)')

# Card bg: warm dark brown -> cool dark
$c = $c.Replace('rgba(28, 22, 18, 0.96)', 'rgba(10, 22, 18, 0.96)')
$c = $c.Replace('rgba(18, 14, 12, 0.98)', 'rgba(6, 14, 12, 0.98)')

[System.IO.File]::WriteAllText($cssPath, $c)
Write-Host "DONE: Swapped to mint green"
