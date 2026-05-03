# ═══════════════════════════════════════════════════════════════════════════════
# convert-fbx-to-glb.ps1
# Batch converts ALL FBX files to GLB for Babylon.js native loading.
#
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/convert-fbx-to-glb.ps1
#
# Requires: FBX2glTF (installed via npm: fbx2gltf@0.9.7p1)
# ═══════════════════════════════════════════════════════════════════════════════

$FBX2GLTF = "C:\Users\nugye\npm-global\node_modules\fbx2gltf\bin\Windows_NT\FBX2glTF.exe"
$REPO = "D:\GrudgeWorld-Action-RPG"
$UNITY_FRESH = "D:\Games\Models\grudgeracecharacters\Il2CppDumper-master\Il2CppDumper-master\GRUDGE-NFT-Island-main\GRUDGE-NFT-Island-main\FRESH GRUDGE\Assets"
$UMMORPG = "F:\onedrive\Desktop\uMMORPG-main"

# Output directory for converted files
$OUT = "$REPO\assets\glb"
New-Item -ItemType Directory -Force -Path "$OUT\characters\races" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\anims\base" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\anims\sword_shield" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\anims\longbow" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\anims\magic" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\anims\warrior_packs" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\anims\extras" | Out-Null
New-Item -ItemType Directory -Force -Path "$OUT\effects" | Out-Null

function Convert-FBX {
    param([string]$InputPath, [string]$OutputPath)
    if (-not (Test-Path $InputPath)) {
        Write-Host "  SKIP (not found): $InputPath" -ForegroundColor Yellow
        return $false
    }
    # FBX2glTF auto-appends .glb, so strip it from output path
    $outStem = $OutputPath -replace '\.glb$',''
    $outDir = Split-Path $outStem -Parent
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    & $FBX2GLTF --binary --input $InputPath --output $outStem 2>&1 | Out-Null
    # FBX2glTF creates <stem>.glb
    $expectedFile = "$outStem.glb"
    if (Test-Path $expectedFile) {
        Write-Host "  OK: $expectedFile" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  FAIL: $InputPath" -ForegroundColor Red
        return $false
    }
}

$total = 0; $success = 0

# ═══ 1. RACE CHARACTER MODELS (6) ════════════════════════════════════════════
Write-Host "`n=== RACE CHARACTER MODELS ===" -ForegroundColor Cyan
$races = @{
    "human"     = "$REPO\assets\characters\races\human\WK_Characters_customizable.FBX"
    "barbarian" = "$REPO\assets\characters\races\barbarian\BRB_Characters_customizable.FBX"
    "elf"       = "$REPO\assets\characters\races\elf\ELF_Characters_customizable.FBX"
    "dwarf"     = "$REPO\assets\characters\races\dwarf\DWF_Characters_customizable.FBX"
    "orc"       = "$REPO\assets\characters\races\orc\ORC_Characters_Customizable.FBX"
    "undead"    = "$REPO\assets\characters\races\undead\UD_Characters_customizable.FBX"
}
foreach ($race in $races.GetEnumerator()) {
    $total++
    $out = "$OUT\characters\races\$($race.Key).glb"
    if (Convert-FBX $race.Value $out) { $success++ }
}

# ═══ 2. BASE ANIMATIONS (9) ══════════════════════════════════════════════════
Write-Host "`n=== BASE ANIMATIONS ===" -ForegroundColor Cyan
Get-ChildItem "$REPO\assets\characters\races\animations" -Filter "*.fbx" | ForEach-Object {
    $total++
    $name = $_.BaseName
    $out = "$OUT\anims\base\$name.glb"
    if (Convert-FBX $_.FullName $out) { $success++ }
}

# ═══ 3. PRO SWORD & SHIELD (45) ═════════════════════════════════════════════
Write-Host "`n=== PRO SWORD & SHIELD ===" -ForegroundColor Cyan
Get-ChildItem "$REPO\assets\Pro Sword and Shield Pack" -Filter "*.fbx" | ForEach-Object {
    $total++
    $name = $_.BaseName -replace '[^\w\-]', '_'
    $out = "$OUT\anims\sword_shield\$name.glb"
    if (Convert-FBX $_.FullName $out) { $success++ }
}

# ═══ 4. PRO LONGBOW (39) ═════════════════════════════════════════════════════
Write-Host "`n=== PRO LONGBOW ===" -ForegroundColor Cyan
Get-ChildItem "$REPO\assets\Pro Longbow Pack" -Filter "*.fbx" | ForEach-Object {
    $total++
    $name = $_.BaseName -replace '[^\w\-]', '_'
    $out = "$OUT\anims\longbow\$name.glb"
    if (Convert-FBX $_.FullName $out) { $success++ }
}

# ═══ 5. PRO MAGIC (52) ═══════════════════════════════════════════════════════
Write-Host "`n=== PRO MAGIC ===" -ForegroundColor Cyan
Get-ChildItem "$REPO\assets\Pro Magic Pack" -Filter "*.fbx" | ForEach-Object {
    $total++
    $name = $_.BaseName -replace '[^\w\-]', '_'
    $out = "$OUT\anims\magic\$name.glb"
    if (Convert-FBX $_.FullName $out) { $success++ }
}

# ═══ 6. UNITY WARRIOR PACKS (ExplosiveLLC) ═══════════════════════════════════
Write-Host "`n=== UNITY WARRIOR PACKS ===" -ForegroundColor Cyan
Get-ChildItem "$UNITY_FRESH\ExplosiveLLC" -Filter "*.fbx" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $total++
    $name = $_.BaseName -replace '[^\w\-@]', '_'
    $out = "$OUT\anims\warrior_packs\$name.glb"
    if (Convert-FBX $_.FullName $out) { $success++ }
}

# ═══ 7. UNITY PLAYER EXTRAS (spin combo, taunt, crouch) ═════════════════════
Write-Host "`n=== PLAYER EXTRAS ===" -ForegroundColor Cyan
$extras = @(
    "$UMMORPG\Prefabs\Entities\Players\Northern Soul Spin Combo.fbx",
    "$UMMORPG\Prefabs\Entities\Players\Standing Taunt Battlecry.fbx",
    "$UMMORPG\Prefabs\Entities\Players\Standing To Crouch.fbx",
    "$UMMORPG\Models\Projectiles\Arrow\arrow.fbx"
)
foreach ($fx in $extras) {
    $total++
    $name = (Split-Path $fx -Leaf) -replace '\.fbx$','' -replace '[^\w\-]','_'
    $out = "$OUT\anims\extras\$name.glb"
    if (Convert-FBX $fx $out) { $success++ }
}

# ═══ 8. PARTICLE EFFECT MODELS ═══════════════════════════════════════════════
Write-Host "`n=== PARTICLE EFFECT MODELS ===" -ForegroundColor Cyan
$particleModels = @(
    "Dark_Shield", "Distortion", "Fireball", "Fireball (Low Quality)",
    "Hammer", "Ice Lance", "Ice Lance 2", "Ice Lance 3", "Ice Lance(Low Quality)",
    "Ice Rock", "Nature_Shield", "Potion", "Rock", "Rock 2", "Rock 3",
    "Rock Icicle", "Rock_Low", "Skull", "Sword", "Tome", "Book", "Crystal", "Mushroom"
)
foreach ($pm in $particleModels) {
    $fbxPath = "$UMMORPG\Prefabs\Particles\Models\$pm.FBX"
    if (Test-Path $fbxPath) {
        $total++
        $name = $pm -replace '[^\w\-]','_'
        $out = "$OUT\effects\$name.glb"
        if (Convert-FBX $fbxPath $out) { $success++ }
    }
}

# ═══ 9. TOON_RTS NATIVE CAVALRY/CATAPULT ANIMS ══════════════════════════════
Write-Host "`n=== TOON_RTS CAVALRY/CATAPULT ===" -ForegroundColor Cyan
Get-ChildItem "$UNITY_FRESH\Toon_RTS\WesternKingdoms\animation" -Filter "*.fbx" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $total++
    $name = $_.BaseName -replace '[^\w\-]','_'
    $out = "$OUT\anims\extras\$name.glb"
    if (Convert-FBX $_.FullName $out) { $success++ }
}

# ═══ SUMMARY ═════════════════════════════════════════════════════════════════
Write-Host "`n════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "CONVERSION COMPLETE: $success / $total succeeded" -ForegroundColor $(if ($success -eq $total) { "Green" } else { "Yellow" })
Write-Host "Output: $OUT" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
