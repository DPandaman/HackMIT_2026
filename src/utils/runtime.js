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

export async function connectArduino() {
  if (!("serial" in navigator)) {
    throw new Error(
      "Web Serial is not supported. Please use Chrome or Edge."
    );
  }

  // Already connected
  if (arduinoPort) {
    return;
  }

  arduinoPort = await navigator.serial.requestPort();

  await arduinoPort.open({
    baudRate: 115200,
  });
}

export async function disconnectArduino() {
  if (!arduinoPort) {
    return;
  }

  if (arduinoWriter) {
    arduinoWriter.releaseLock();
    arduinoWriter = null;
  }

  await arduinoPort.close();
  arduinoPort = null;
}

export async function sendArduino(message) {
  if (!arduinoPort || !arduinoPort.writable) {
    throw new Error("Arduino is not connected.");
  }

  if (!arduinoWriter) {
    arduinoWriter = arduinoPort.writable.getWriter();
  }

  const encoder = new TextEncoder();

  await arduinoWriter.write(
    encoder.encode(`${String(message)}\n`)
  );
}

export function isArduinoConnected() {
  return arduinoPort !== null;
}