param()
$FBX2GLTF = "C:\Users\nugye\npm-global\node_modules\fbx2gltf\bin\Windows_NT\FBX2glTF.exe"
$BASE = "F:\GitHub\GrudgeWorld-Action-RPG"
$SRC = "$BASE\assets\Grudge Warlords - Ultimate Character Builder_files"
$OUT = "$BASE\assets\glb\vfx"
New-Item -ItemType Directory -Force -Path $OUT | Out-Null

$vfx = @(
    "Fireball_1773556670984.FBX|fireball",
    "Fireball_(Low_Quality)_1773556670984.FBX|fireball_low",
    "Ice_Lance_1773556670983.FBX|ice_lance",
    "Ice_Lance(Low_Quality)_1773556670983.FBX|ice_lance_low",
    "Potion_1773556670982.FBX|potion"
)

foreach ($entry in $vfx) {
    $parts = $entry -split "\|"
    $srcFile = "$SRC\$($parts[0])"
    $outFile = "$OUT\$($parts[1])"
    Write-Host "  Converting: $($parts[0]) -> $($parts[1]).glb"
    & $FBX2GLTF --binary --output $outFile $srcFile 2>&1
    if (Test-Path "$outFile.glb") {
        $sz = [math]::Round((Get-Item "$outFile.glb").Length / 1KB)
        Write-Host "    OK ($sz KB)"
    }
    else {
        Write-Warning "    FAILED"
    }
}
Write-Host "Done."
