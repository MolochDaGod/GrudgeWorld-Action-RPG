# convert-assets.ps1 - Batch FBX to GLB converter for Grudge Warlords

$FBX2GLT = "C:\Users\nugye\npm-global\node_modules\fbx2gltf\bin\Windows_NT\FBX2glTF.exe"
$ROOT = Split-Path $PSScriptRoot -Parent
$SRC = "$ROOT\assets\Grudge Warlords - Ultimate Character Builder_files"
$ANIM_SRC = "$ROOT\assets\glb\characters\animiationsfrom brb\animationsofbrrb\New folder"
$RACES_OUT = "$ROOT\assets\glb\characters\races"
$ANIMS_OUT = "$ROOT\assets\glb\anims\extras"
$VFX_OUT = "$ROOT\assets\glb\vfx"

function Slugify($name) {
    $s = $name.ToLower()
    $s = $s -replace '[^a-z0-9 _]', ' '
    $s = $s.Trim() -replace '\s+', '_'
    return $s
}

function Convert-FBX {
    param(
        [string]$src,
        [string]$outDir,
        [string]$outName,
        [switch]$EmbedResources
    )
    $outGlb = Join-Path $outDir "$outName.glb"
    if (Test-Path $outGlb) {
        Write-Host "  SKIP (exists): $outName.glb"
        return
    }
    New-Item -ItemType Directory -Force $outDir | Out-Null
    $fbxArgs = @("--input", $src, "--output", $outGlb, "--binary")
    if ($EmbedResources) { $fbxArgs += "--embed-resources" }
    $fname = [System.IO.Path]::GetFileName($src)
    Write-Host "  Converting: $fname -> $outName.glb"
    & $FBX2GLT @fbxArgs 2>&1 | Where-Object { $_ -match 'error|warn' } | ForEach-Object { Write-Warning $_ }
    if (Test-Path $outGlb) {
        $kb = [math]::Round((Get-Item $outGlb).Length / 1024)
        Write-Host "    OK ($kb KB)"
    }
    else {
        Write-Warning "    FAILED - output not created"
    }
}

Write-Host ""
Write-Host "[1/4] Barbarian character model"
$brbFbx = "$SRC\BRB_Characters_customizable_1777048976083.FBX"
Convert-FBX -src $brbFbx -outDir $RACES_OUT -outName "barbarian" -EmbedResources

Write-Host ""
Write-Host "[2/4] New animation FBXes from BRB pack"
Get-ChildItem $ANIM_SRC -Filter "*.fbx" | ForEach-Object {
    $slug = Slugify $_.BaseName
    Convert-FBX -src $_.FullName -outDir $ANIMS_OUT -outName $slug
}

Write-Host ""
Write-Host "[3/4] Combat animations from builder source"
$combatFbxs = @(
    @{ src = "$SRC\Great_Sword_Jump_Attack_1774595963067.fbx"; out = "great_sword_jump_attack" },
    @{ src = "$SRC\Jump_Attack_1774595952671.fbx"; out = "jump_attack" },
    @{ src = "$SRC\Jumping_(1)_1774595983516.fbx"; out = "jumping" },
    @{ src = "$SRC\Jumping_Down_(1)_1774595983516.fbx"; out = "jumping_down" },
    @{ src = "$SRC\Jump--InAir.anim_1776888204473.fbx"; out = "jump_in_air" },
    @{ src = "$SRC\Jump--Jump.anim_1776888204474.fbx"; out = "jump_loop" },
    @{ src = "$SRC\Stabbing_1774595970327.fbx"; out = "stabbing" },
    @{ src = "$SRC\Throw_Object_1774596013641.fbx"; out = "throw_object" },
    @{ src = "$SRC\Tripping_1774596013643.fbx"; out = "tripping" },
    @{ src = "$SRC\BRB_mage_11_cast_B_1777049084374.FBX"; out = "brb_mage_cast" },
    @{ src = "$SRC\BRB_spearman_07_attack_1777049076353.FBX"; out = "brb_spearman_attack" },
    @{ src = "$SRC\arrow_1776899230293.fbx"; out = "arrow" }
)
foreach ($item in $combatFbxs) {
    if (Test-Path $item.src) {
        Convert-FBX -src $item.src -outDir $ANIMS_OUT -outName $item.out
    }
    else {
        Write-Warning "  NOT FOUND: $($item.src)"
    }
}

Write-Host ""
Write-Host "[4/4] VFX mesh models"
$vfxFbxs = @(
    @{ src = "$SRC\Fireball_1773556670984.FBX"; out = "fireball" },
    @{ src = "$SRC\Fireball_(Low_Quality)_1773556670984.FBX"; out = "fireball_low" },
    @{ src = "$SRC\Ice_Lance_1773556670983.FBX"; out = "ice_lance" },
    @{ src = "$SRC\Ice_Lance(Low_Quality)_1773556670983.FBX"; out = "ice_lance_low" },
    @{ src = "$SRC\Potion_1773556670982.FBX"; out = "potion" }
)
foreach ($item in $vfxFbxs) {
    if (Test-Path $item.src) {
        Convert-FBX -src $item.src -outDir $VFX_OUT -outName $item.out -EmbedResources
    }
    else {
        Write-Warning "  NOT FOUND: $($item.src)"
    }
}

Write-Host ""
Write-Host "=== Conversion complete ==="
