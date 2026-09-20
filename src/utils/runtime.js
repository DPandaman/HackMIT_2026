let arduinoPort = null;
let arduinoWriter = null;

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