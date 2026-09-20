let arduinoPort = null;
let arduinoWriter = null;
let arduinoReader = null;
let arduinoReadBuffer = "";

let recognition = null;
let isListening = false;
let phraseCallbacks = [];

const keysPressed = new Set();

function normalizeKey(key) {
  const rawKey = String(key ?? "").toLowerCase();
  if (rawKey === " ") return " ";

  const normalized = rawKey.trim();
  return normalized === "space" ? " " : normalized;
}

window.addEventListener("keydown", (event) => {
  keysPressed.add(normalizeKey(event.key));
});

window.addEventListener("keyup", (event) => {
  keysPressed.delete(normalizeKey(event.key));
});

export function isKeyPressed(key) {
  return keysPressed.has(normalizeKey(key));
}

export function moveSprite(currentPosition, distance) {
  return {
    ...currentPosition,
    x: Math.max(
      4,
      Math.min(
        96,
        currentPosition.x +
        (Math.cos((currentPosition.rotation * Math.PI) / 180) * distance) / 4
      )
    ),
    y: Math.max(
      8,
      Math.min(
        92,
        currentPosition.y +
        (Math.sin((currentPosition.rotation * Math.PI) / 180) * distance) / 4
      )
    ),
  };
}

export function wait(seconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, seconds) * 1000)
  );
}

const AI_ENDPOINT = "/api/ask";

export async function askAI(prompt, kind = "text") {
  const trimmedPrompt = (prompt || "").trim();
  if (!trimmedPrompt) return kind === "number" ? "0" : "(no prompt given)";

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: trimmedPrompt, kind }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `AI request failed (${response.status})`);
    }

    const data = await response.json();
    return data.answer ?? (kind === "number" ? "0" : "(AI returned nothing)");
  } catch (error) {
    console.error("askAI error:", error);
    return kind === "number" ? "0" : "(AI is unavailable right now)";
  }
}

export async function connectArduino(setSerialOutput) {
  if (!("serial" in navigator)) {
    throw new Error(
      "Web Serial is not supported. Please use Chrome or Edge."
    );
  }

  if (arduinoPort) {
    return;
  }

  const port = await navigator.serial.requestPort();
  try {
    await port.open({ baudRate: 115200 });
    if (!port.writable) {
      throw new Error("The selected serial device is not writable.");
    }

    arduinoPort = port;
    arduinoWriter = port.writable.getWriter();
    setSerialOutput?.((current) => [...current, "Connected to Arduino"]);
    startSerialReader(port, setSerialOutput);
  } catch (error) {
    await port.close().catch(() => { });
    throw error;
  }
}

function startSerialReader(port, setSerialOutput) {
  if (!port.readable || !setSerialOutput) return;

  const reader = port.readable.getReader();
  arduinoReader = reader;
  void (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (value) {
          arduinoReadBuffer += new TextDecoder().decode(value);
          const lines = arduinoReadBuffer.split(/\r?\n/);
          arduinoReadBuffer = lines.pop() || "";
          if (lines.length > 0) {
            setSerialOutput((current) => [...current, ...lines]);
          }
        }
      }
    } catch (error) {
      if (arduinoPort === port) console.error("Serial read error:", error);
    } finally {
      reader.releaseLock();
      if (arduinoReader === reader) arduinoReader = null;
    }
  })();
}

export async function disconnectArduino() {
  const port = arduinoPort;
  arduinoPort = null;

  if (arduinoReader) {
    await arduinoReader.cancel();
    arduinoReader = null;
  }

  if (arduinoWriter) {
    arduinoWriter.releaseLock();
    arduinoWriter = null;
  }

  if (port) {
    await port.close();
  }
  arduinoReadBuffer = "";
}

export async function sendArduino(message, setSerialOutput) {
  if (!arduinoPort || !arduinoWriter) {
    throw new Error("Arduino is not connected.");
  }

  const data = new TextEncoder().encode(`${message}\n`);
  await arduinoWriter.write(data);
  setSerialOutput?.((current) => [...current, `> ${String(message)}`]);
}

export function isArduinoConnected() {
  return arduinoPort !== null;
}

export function isSpeechRecognitionSupported() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function startListening() {
  if (!isSpeechRecognitionSupported()) {
    throw new Error("Speech recognition is not supported. Please use Chrome or Edge.");
  }

  if (isListening) {
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();

      if (event.results[i].isFinal) {
        // Notify all waiting callbacks
        phraseCallbacks.forEach(callback => callback(transcript));
        phraseCallbacks = [];
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    // Notify all callbacks of error
    phraseCallbacks.forEach(callback => callback(null));
    phraseCallbacks = [];
  };

  recognition.onend = () => {
    if (isListening) {
      recognition.start();
    }
  };

  recognition.start();
  isListening = true;
}

export function stopListening() {
  if (recognition) {
    isListening = false;
    recognition.stop();
    recognition = null;
  }
}

export async function waitForPhrase(targetPhrase, timeout = 10000) {
  if (!isListening) {
    startListening();
  }

  const normalizedTarget = targetPhrase.toLowerCase().trim();
  const startTime = Date.now();
  let resolved = false;

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    }, 100);

    const onPhrase = (phrase) => {
      if (!resolved && phrase && phrase.includes(normalizedTarget)) {
        clearInterval(checkInterval);
        resolved = true;
        resolve(true);
      }
    };

    phraseCallbacks.push(onPhrase);
  });
}