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
import random
import re

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from huggingface_hub import InferenceClient
except ImportError:  # pragma: no cover
    InferenceClient = None

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (a different port) to call this

MODEL = "Qwen/Qwen3-4B-Instruct-2507"
MAX_TOKENS = 60
MAX_ANSWER_CHARS = 120
NUMBER_PATTERN = re.compile(r"-?\d+(?:\.\d+)?")

TEMPERATURE = 1.1
TOP_P = 0.95

SYSTEM_PROMPTS = {
    "text": (
        "You are helping fill in a text value for a block inside a kids' "
        "visual-programming game, similar to Scratch (for example: what a "
        "sprite should say, or a short message). Reply with ONLY the value "
        "itself -- no quotes, no explanation, no markdown -- under 15 words."
    ),
    "number": (
        "You are helping fill in a numeric value for a block inside a kids' "
        "visual-programming game, similar to Scratch (for example: how many "
        "steps to move, or how many degrees to turn). Reply with ONLY a "
        "number -- digits, optionally a decimal point -- no words, no "
        "units, no explanation."
    ),
    "boolean": (
        "You are deciding a yes/no outcome for an 'if' condition inside a "
        "kids' visual-programming game, similar to Scratch. Reply with ONLY "
        "the single word 'true' or 'false' -- no punctuation, no "
        "explanation, nothing else."
    ),
}

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
    kind = body.get("kind") if body.get("kind") in SYSTEM_PROMPTS else "text"

    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    try:
        client = get_client()
        messages = [
            {"role": "system", "content": SYSTEM_PROMPTS[kind]},
            {"role": "user", "content": prompt},
        ]

        try:
            response = client.chat_completion(
                messages=messages,
                model=MODEL,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                top_p=TOP_P,
                seed=random.randint(0, 2_000_000_000),
            )
        except Exception:
            response = client.chat_completion(
                messages=messages,
                model=MODEL,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                top_p=TOP_P,
            )

        raw_answer = (response.choices[0].message.content or "").strip().strip('"')

        if kind == "number":
            match = NUMBER_PATTERN.search(raw_answer)
            answer = match.group(0) if match else "0"
        else:
            answer = raw_answer
            if len(answer) > MAX_ANSWER_CHARS:
                answer = answer[: MAX_ANSWER_CHARS - 1].rstrip() + "\u2026"

        fallback = "0" if kind == "number" else "(empty response)"
        return jsonify({"answer": answer or fallback})
    except Exception as exc:  # noqa: BLE001 - surface any provider/config error to the block
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)