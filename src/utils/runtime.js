let arduinoPort = null;
let arduinoWriter = null;

let recognition = null;
let isListening = false;
let phraseCallbacks = [];

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

const AI_ENDPOINT = "http://localhost:5000/api/ask";

export async function askAI(prompt) {
  const trimmedPrompt = (prompt || "").trim();
  if (!trimmedPrompt) return "(no prompt given)";

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: trimmedPrompt }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `AI request failed (${response.status})`);
    }

    const data = await response.json();
    return data.answer || "(AI returned nothing)";
  } catch (error) {
    console.error("askAI error:", error);
    return "(AI is unavailable right now)";
  }
}

export async function connectArduino() {
  if (!("serial" in navigator)) {
    throw new Error(
      "Web Serial is not supported. Please use Chrome or Edge."
    );
  }

  if (arduinoPort) {
    return;
  }

  arduinoPort = await navigator.serial.requestPort();
  await arduinoPort.open({ baudRate: 115200 });

  arduinoWriter = arduinoPort.writable.getWriter();
}

export async function disconnectArduino() {
  if (arduinoWriter) {
    arduinoWriter.releaseLock();
    arduinoWriter = null;
  }

  if (arduinoPort) {
    await arduinoPort.close();
    arduinoPort = null;
  }
}

export async function sendArduino(message) {
  if (!arduinoWriter) {
    throw new Error("Arduino is not connected.");
  }

  const data = new TextEncoder().encode(`${message}\n`);
  await arduinoWriter.write(data);
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