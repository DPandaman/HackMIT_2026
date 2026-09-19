export function StagePanel({ position, resetSprite, setSpriteName, speech, spriteHidden, spriteName, status }) {
  return (
    <section className="stage-panel">
      <div className="stage-heading">
        <h2>Stage</h2>
        <span>{status}</span>
      </div>
      <div className="stage">
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
          🐱
        </div>
        <div className="speech" hidden={!speech}>{speech}</div>
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
