"""
Stable Diffusion Gradio app — test target for @reactjit/gradio.

Uses diffusers with SDXL-Turbo for fast generation on a 12GB GPU.
SDXL-Turbo does 1-4 steps, so generation is near-instant.

Usage:
  python app.py                    # Launch on default port 7860
  rjit gradio app.py               # Launch headless + render in ReactJIT
  rjit gradio http://localhost:7860 # Connect to already-running server
"""

import gradio as gr
import torch
from diffusers import AutoPipelineForText2Image

# ── Model setup ──────────────────────────────────────────

MODEL_ID = "stabilityai/sdxl-turbo"

print(f"Loading {MODEL_ID}...")
pipe = AutoPipelineForText2Image.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16,
    variant="fp16",
)
pipe = pipe.to("cuda")
print("Model loaded.")

# ── Samplers ─────────────────────────────────────────────

SAMPLERS = ["Euler", "Euler a", "DPM++ 2M", "DPM++ SDE", "LCM"]

# ── Generate function ───────────────────────────────────

def generate(
    prompt: str,
    negative_prompt: str,
    steps: int,
    guidance_scale: float,
    width: int,
    height: int,
    seed: int,
):
    if not prompt.strip():
        return None

    generator = torch.Generator("cuda")
    if seed >= 0:
        generator = generator.manual_seed(seed)

    image = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt or None,
        num_inference_steps=int(steps),
        guidance_scale=guidance_scale,
        width=int(width),
        height=int(height),
        generator=generator,
    ).images[0]

    return image

# ── Gradio UI ────────────────────────────────────────────

with gr.Blocks(title="Stable Diffusion — ReactJIT") as demo:
    gr.Markdown("# Stable Diffusion (SDXL-Turbo)")
    gr.Markdown("Fast image generation with 1-4 steps. Powered by ReactJIT.")

    with gr.Row():
        with gr.Column(scale=1):
            prompt = gr.Textbox(
                label="Prompt",
                placeholder="A photo of a cat wearing sunglasses on a beach...",
                lines=3,
            )
            negative_prompt = gr.Textbox(
                label="Negative Prompt",
                placeholder="blurry, low quality, distorted",
                lines=2,
            )

            with gr.Row():
                steps = gr.Slider(
                    minimum=1, maximum=8, value=4, step=1,
                    label="Steps",
                )
                guidance = gr.Slider(
                    minimum=0.0, maximum=2.0, value=0.0, step=0.1,
                    label="Guidance Scale",
                )

            with gr.Row():
                width = gr.Slider(
                    minimum=256, maximum=1024, value=512, step=64,
                    label="Width",
                )
                height = gr.Slider(
                    minimum=256, maximum=1024, value=512, step=64,
                    label="Height",
                )

            seed = gr.Number(label="Seed (-1 = random)", value=-1)
            generate_btn = gr.Button("Generate", variant="primary")

        with gr.Column(scale=1):
            output_image = gr.Image(label="Output", type="pil")

    generate_btn.click(
        fn=generate,
        inputs=[prompt, negative_prompt, steps, guidance, width, height, seed],
        outputs=[output_image],
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
