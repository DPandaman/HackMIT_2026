# Local Scratch

A small React Scratch-inspired programming playground that runs entirely in the browser.

## Run locally

From this directory, install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints. Drag blocks from the palette into the code area, click **Run**, and use **Save**/**Load** to persist a project in browser storage.

## AI blocks (optional)
The AI category includes an "ask AI ... and say the answer" block and a
"generate image ..." block. The image block replaces the sprite image on the
stage with the generated PNG. Both call a small local proxy server (llmBlock.py)
instead of talking to a provider directly, so your real API key never sits in
browser code.

To use it, run the proxy alongside the Vite dev server (two terminals):

```bash
# terminal 1 — the AI proxy
pip install flask flask-cors huggingface_hub
$env:HF_TOKEN="hf_YOUR_TOKEN"   # Windows PowerShell
python llmBlock.py

# terminal 2 — the app
npm install
npm run dev
```

Get a free token (a "Read" token is enough) at https://huggingface.co/settings/tokens.

If the proxy isn't running, the text AI block returns "(AI is unavailable right now)".
Image generation reports the provider error in the stage status.