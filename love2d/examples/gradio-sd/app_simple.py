"""
Simple Gradio test app — no GPU required.

Exercises the same component types as the SD app (textbox, slider, dropdown,
button, image output) but uses PIL to generate a simple gradient image.
Use this to validate the ReactJIT Gradio pipeline without waiting for model downloads.

Usage:
  python app_simple.py
  rjit gradio http://localhost:7861
"""

import gradio as gr
from PIL import Image, ImageDraw, ImageFont
import colorsys
import random

def generate(
    prompt: str,
    style: str,
    width: int,
    height: int,
    saturation: float,
    seed: int,
):
    rng = random.Random(seed if seed >= 0 else random.randint(0, 999999))
    w, h = int(width), int(height)

    # Generate a gradient/pattern based on style
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    base_hue = rng.random()

    if style == "Gradient":
        for y in range(h):
            hue = (base_hue + y / h * 0.3) % 1.0
            r, g, b = colorsys.hls_to_rgb(hue, 0.5, saturation)
            draw.line([(0, y), (w, y)], fill=(int(r*255), int(g*255), int(b*255)))

    elif style == "Circles":
        for _ in range(20):
            x1 = rng.randint(0, w)
            y1 = rng.randint(0, h)
            r = rng.randint(20, min(w, h) // 3)
            hue = (base_hue + rng.random() * 0.5) % 1.0
            cr, cg, cb = colorsys.hls_to_rgb(hue, 0.5, saturation)
            draw.ellipse([x1-r, y1-r, x1+r, y1+r],
                         fill=(int(cr*255), int(cg*255), int(cb*255), 180))

    elif style == "Grid":
        cell = max(w, h) // 8
        for x in range(0, w, cell):
            for y in range(0, h, cell):
                hue = (base_hue + (x + y) / (w + h)) % 1.0
                cr, cg, cb = colorsys.hls_to_rgb(hue, 0.4 + rng.random() * 0.3, saturation)
                draw.rectangle([x, y, x+cell-2, y+cell-2],
                               fill=(int(cr*255), int(cg*255), int(cb*255)))

    elif style == "Noise":
        for x in range(0, w, 4):
            for y in range(0, h, 4):
                hue = (base_hue + rng.random() * 0.3) % 1.0
                cr, cg, cb = colorsys.hls_to_rgb(hue, 0.3 + rng.random() * 0.4, saturation)
                draw.rectangle([x, y, x+3, y+3],
                               fill=(int(cr*255), int(cg*255), int(cb*255)))

    # Draw prompt text on the image
    if prompt.strip():
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
        except:
            font = ImageFont.load_default()
        # Text background
        bbox = draw.textbbox((10, h - 40), prompt, font=font)
        draw.rectangle([bbox[0]-4, bbox[1]-2, bbox[2]+4, bbox[3]+2], fill=(0, 0, 0, 180))
        draw.text((10, h - 40), prompt, fill=(255, 255, 255), font=font)

    return img

# ── Gradio UI (mirrors the SD app's component structure) ─

with gr.Blocks(title="Pattern Generator — ReactJIT Test") as demo:
    gr.Markdown("# Pattern Generator")
    gr.Markdown("Test app for the ReactJIT Gradio compatibility layer. No GPU required.")

    with gr.Row():
        with gr.Column(scale=1):
            prompt = gr.Textbox(
                label="Label Text",
                placeholder="Text to overlay on the image...",
                lines=2,
            )
            style = gr.Dropdown(
                choices=["Gradient", "Circles", "Grid", "Noise"],
                value="Gradient",
                label="Pattern Style",
            )

            with gr.Row():
                width = gr.Slider(
                    minimum=128, maximum=1024, value=512, step=64,
                    label="Width",
                )
                height = gr.Slider(
                    minimum=128, maximum=1024, value=512, step=64,
                    label="Height",
                )

            saturation = gr.Slider(
                minimum=0.0, maximum=1.0, value=0.8, step=0.05,
                label="Saturation",
            )

            seed = gr.Number(label="Seed (-1 = random)", value=-1)
            generate_btn = gr.Button("Generate", variant="primary")

        with gr.Column(scale=1):
            output_image = gr.Image(label="Output", type="pil")

    generate_btn.click(
        fn=generate,
        inputs=[prompt, style, width, height, saturation, seed],
        outputs=[output_image],
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7861)
