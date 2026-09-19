export function moveSprite(currentPosition, distance) {
  return {
    ...currentPosition,
    x: Math.max(4, Math.min(96, currentPosition.x + (Math.cos((currentPosition.rotation * Math.PI) / 180) * distance) / 4)),
    y: Math.max(8, Math.min(92, currentPosition.y + (Math.sin((currentPosition.rotation * Math.PI) / 180) * distance) / 4)),
  };
}

export function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000));
}
