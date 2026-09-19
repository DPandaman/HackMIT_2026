export function Topbar({ projectName, resetSprite, saveProject, loadProject, runScript, stopScript, setProjectName }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">🐱</span>
        <strong>Local Scratch</strong>
      </div>
      <div
        className="project-name"
        contentEditable
        suppressContentEditableWarning
        aria-label="Project name"
        onInput={(event) => setProjectName(event.currentTarget.textContent)}
      >
        {projectName}
      </div>
      <div className="top-actions">
        <button className="secondary" onClick={saveProject}>Save</button>
        <button className="secondary" onClick={loadProject}>Load</button>
        <button className="run" onClick={runScript}>▶ Run</button>
        <button className="stop" onClick={stopScript}>■ Stop</button>
        <button className="stop" onClick={resetSprite}>Reset</button>
      </div>
    </header>
  );
}
