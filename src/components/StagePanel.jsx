import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import cat from "../assets/cat.png";

const SPEECH_H_GAP = 14;
const SPEECH_V_OFFSET = 46;
const STAGE_EDGE_PADDING = 8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeSpeechPosition({ stageEl, speechEl, position }) {
  if (!stageEl || !speechEl) return null;

  const stageRect = stageEl.getBoundingClientRect();
  const bubbleRect = speechEl.getBoundingClientRect();
  const spriteCenterX = (position.x / 100) * stageRect.width;
  const spriteCenterY = (position.y / 100) * stageRect.height;

  const onLeftHalf = position.x <= 50;
  const maxLeft = Math.max(STAGE_EDGE_PADDING, stageRect.width - STAGE_EDGE_PADDING - bubbleRect.width);
  const left = onLeftHalf
    ? clamp(spriteCenterX + SPEECH_H_GAP, STAGE_EDGE_PADDING, maxLeft)
    : clamp(spriteCenterX - SPEECH_H_GAP - bubbleRect.width, STAGE_EDGE_PADDING, maxLeft);

  const maxTop = Math.max(STAGE_EDGE_PADDING, stageRect.height - STAGE_EDGE_PADDING - bubbleRect.height);
  const top = clamp(spriteCenterY - SPEECH_V_OFFSET - bubbleRect.height, STAGE_EDGE_PADDING, maxTop);

  return { left: `${left}px`, top: `${top}px`, transform: "none" };
}

export function StagePanel({ position, resetSprite, setSpriteName, speech, spriteHidden, spriteName, spriteImage, status }) {
  const stageRef = useRef(null);
  const speechRef = useRef(null);
  const [speechStyle, setSpeechStyle] = useState(null);

  const updateSpeechPosition = useCallback(() => {
    if (!speech) return;
    const next = computeSpeechPosition({ stageEl: stageRef.current, speechEl: speechRef.current, position });
    if (next) setSpeechStyle(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.y, speech]);

  useLayoutEffect(() => {
    updateSpeechPosition();
  }, [updateSpeechPosition]);

  useEffect(() => {
    window.addEventListener("resize", updateSpeechPosition);
    return () => window.removeEventListener("resize", updateSpeechPosition);
  }, [updateSpeechPosition]);

  return (
    <section className="stage-panel">
      <div className="stage-heading">
        <h2>Stage</h2>
        <span>{status}</span>
      </div>
      <div className="stage" ref={stageRef}>
        <div
          className="sprite"
          aria-label={`${spriteName} sprite`}
          hidden={spriteHidden}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
          }}
        >
          <img src={spriteImage || cat} width="70" height="70" alt={`${spriteName} sprite`}></img>
        </div>
        <div className="speech" ref={speechRef} hidden={!speech} style={speechStyle ?? undefined}>
          {speech}
        </div>
      </div>
      <div className="sprite-controls">
        <label>
          Sprite <input value={spriteName} onChange={(event) => setSpriteName(event.target.value)} />
        </label>
        <button className="secondary" onClick={resetSprite}>Reset position</button>
      </div>
    </section>
  );
}
