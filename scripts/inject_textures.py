"""
inject_textures.py
==================
Replaces placeholder 1x1 textures in race GLBs with real TGA/PNG textures.

Usage:
  python scripts/inject_textures.py

Requires: pip install pygltflib Pillow
"""

import base64, io, json, os, struct, sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow not installed. Run: pip install Pillow")

try:
    import pygltflib
except ImportError:
    sys.exit("pygltflib not installed. Run: pip install pygltflib")

ROOT = Path(__file__).parent.parent
SRC  = ROOT / "assets" / "Grudge Warlords - Ultimate Character Builder_files"
RACES_DIR = ROOT / "assets" / "glb" / "characters" / "races"

# Maps race GLB → list of TGA source files to embed (first one = primary diffuse)
TEXTURE_MAP = {
    "human.glb":    [SRC / "WK_Standard_Units_1776876607036.tga"],
    "barbarian.glb":[SRC / "BRB_StandardUnits_texture_1777048993245.tga"],
    "dwarf.glb":    [SRC / "DWF_Standard_Units_1777048694189.tga"],
}


def tga_to_png_bytes(tga_path: Path) -> bytes:
    """Convert TGA file to PNG bytes in memory."""
    print(f"  Converting {tga_path.name} → PNG …")
    img = Image.open(tga_path)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def inject_into_glb(glb_path: Path, png_bytes_list: list[bytes]) -> bool:
    """Replace the first texture in a GLB with new PNG data."""
    if not glb_path.exists():
        print(f"  SKIP: {glb_path.name} not found")
        return False

    print(f"  Loading {glb_path.name} …")
    gltf = pygltflib.GLTF2().load(str(glb_path))

    if not gltf.images:
        print(f"  SKIP: {glb_path.name} has no images defined")
        return False

    # Convert each image listed and replace sequentially
    for i, png_bytes in enumerate(png_bytes_list):
        if i >= len(gltf.images):
            break

        image_obj = gltf.images[i]
        print(f"  Replacing image[{i}] ({image_obj.name or 'unnamed'}) …")

        # Encode new PNG as data URI
        b64 = base64.b64encode(png_bytes).decode("ascii")
        image_obj.uri = f"data:image/png;base64,{b64}"
        image_obj.mimeType = "image/png"
        # Clear buffer view reference so it uses the URI
        image_obj.bufferView = None

    out_path = glb_path
    gltf.save(str(out_path))
    size_kb = out_path.stat().st_size // 1024
    print(f"  Saved → {out_path.name}  ({size_kb} KB)")
    return True


def main():
    print("=== GLB Texture Injector ===\n")
    for glb_name, tga_paths in TEXTURE_MAP.items():
        glb_path = RACES_DIR / glb_name
        print(f"[{glb_name}]")

        png_list = []
        for tga_path in tga_paths:
            if not tga_path.exists():
                print(f"  WARNING: texture not found: {tga_path}")
                continue
            png_list.append(tga_to_png_bytes(tga_path))

        if not png_list:
            print(f"  SKIP: no valid textures found\n")
            continue

        inject_into_glb(glb_path, png_list)
        print()

    print("Done.")


if __name__ == "__main__":
    main()
