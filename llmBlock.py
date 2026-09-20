"""
Local proxy for the "ask AI" block.

Why this exists: the browser can't safely hold a real API token (anyone can
view-source it), so the "ask AI" block in the app calls this tiny local
server instead, and this server is the only thing that talks to Hugging
Face's Inference API, using a token it keeps in an environment variable.

Setup:
    pip install flask flask-cors huggingface_hub

    export HF_TOKEN=your-hugging-face-token-here      # macOS/Linux
    set HF_TOKEN=your-hugging-face-token-here          # Windows (cmd)
    $env:HF_TOKEN="your-hugging-face-token-here"       # Windows (PowerShell)

Get a token at https://huggingface.co/settings/tokens (a free "Read" token
works for the Inference API).

Run:
    python llmBlock.py

The app's runtime.js points at http://localhost:5000/api/ask by default --
keep this running alongside `npm run dev` while you use the AI block.
"""

import os

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from huggingface_hub import InferenceClient
except ImportError:  # pragma: no cover
    InferenceClient = None

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (a different port) to call this

# A small instruct model that's reliably available on HF's free Inference API.
# Swap this for another model id if you'd rather use a different one.
MODEL = "Qwen/Qwen3-4B-Instruct-2507"
MAX_TOKENS = 200

_client = None


def get_client():
    global _client
    if _client is None:
        if InferenceClient is None:
            raise RuntimeError("Run `pip install huggingface_hub` first.")
        token = os.environ.get("HF_TOKEN")
        if not token:
            raise RuntimeError("Set the HF_TOKEN environment variable first.")
        _client = InferenceClient(token=token)
    return _client


@app.route("/api/ask", methods=["POST"])
def ask():
    body = request.get_json(force=True, silent=True) or {}
    prompt = (body.get("prompt") or "").strip()

    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    try:
        client = get_client()
        response = client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL,
            max_tokens=MAX_TOKENS,
        )
        answer = (response.choices[0].message.content or "").strip()
        return jsonify({"answer": answer or "(empty response)"})
    except Exception as exc:  # noqa: BLE001 - surface any provider/config error to the block
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)