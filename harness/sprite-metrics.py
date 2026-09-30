"""Measure sprite-gen source/curated geometry. Never edits images.

Run with the sprite-gen virtualenv: canonical matte/component utilities are
the same ones used during extraction, rather than a second cutting pipeline.
"""
import json
from pathlib import Path
from PIL import Image
from sprite_gen.frames.extract import (
    remove_chroma_background, extract_component_images, _alpha_centroid_x,
)

for character in ("maya", "bruno"):
    asset_name = {"maya": "rina-sabre", "bruno": "waggy"}[character]
    published = Path("assets/sprites") / asset_name
    provenance = json.loads((published / "provenance.json").read_text())
    root = Path(provenance["generationRun"])
    request = json.loads((root / "sprite-request.json").read_text())
    measurements = {}
    for state, spec in request["states"].items():
        raw = root / "raw" / f"{state}.png"
        with Image.open(raw) as image:
            keyed = remove_chroma_background(image, tuple(request["chroma_key"]["rgb"]), 96, 180, 18)
        components = extract_component_images(keyed, spec["frames"])
        if not components or len(components) != spec["frames"]:
            raise RuntimeError(f"{character}/{state}: cannot measure canonical source components")
        curated = published / "curated"
        files = sorted(curated.glob(f"{state}-*.png"), key=lambda p: int(p.stem.rsplit("-", 1)[-1]))
        if len(files) != len(components):
            raise RuntimeError(f"{character}/{state}: curated/source frame mismatch")
        entries = []
        for source, file in zip(components, files):
            source_box = source.getbbox()
            with Image.open(file) as image:
                box = image.getbbox()
                if not box or not source_box:
                    raise RuntimeError(f"Empty sprite {file}")
                entries.append({
                    "path": file.as_posix(),
                    "sourceHeight": source_box[3] - source_box[1],
                    "outputHeight": box[3] - box[1],
                    "anchorX": (box[0] + _alpha_centroid_x(image.crop(box), .2)) / image.width,
                    "anchorY": box[3] / image.height,
                })
        measurements[state] = entries
    idle = measurements["idle"][0]
    reference = idle["outputHeight"] / idle["sourceHeight"]
    # Each GPT row has an independent camera scale. Calibrate it against a
    # reviewed reference pose in THAT row rather than comparing raw row pixels.
    # Targets describe pose height, not body size: folded knees remain shorter.
    calibration = {
        "idle": (0, 320), "punch": (0, 320), "kick": (0, 320),
        "hurt": (3, 320), "special": (3, 320), "walk": (0, 320),
        "block": (0, 320), "crouch": (0, 320), "celebrate": (0, 320),
        "ko": (0, 305), "jump": (1, 280),
        "airPunch": (0, 265), "airKick": (0, 265),
        "crouchPunch": (0, 230), "crouchKick": (0, 230),
        "sweep": (0, 230), "lowBlock": (0, 230),
        "uppercut": (3, 320), "dash": (0, 300), "backwalk": (0, 320),
        "turn": (0, 320), "land": (3, 320), "jumpForward": (1, 280),
    }
    for state, entries in measurements.items():
        pose, target = calibration[state]
        row_factor = target / (320 * entries[pose]["sourceHeight"] / idle["sourceHeight"])
        for frame in entries:
            frame["scale"] = round(reference * frame["sourceHeight"] / frame["outputHeight"] * row_factor, 5)
            frame["rowScaleCorrection"] = round(row_factor, 5)
            frame["referencePose"] = pose
            frame["referencePoseHeight"] = target
    (root / "runtime-metrics.json").write_text(json.dumps(measurements, indent=2))
    if published.exists():
        (published / "runtime-metrics.json").write_text(json.dumps(measurements, indent=2))
    print(character, "measured", sum(map(len, measurements.values())), "frames")
