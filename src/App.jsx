import { Block } from "./components/Block";
import { CategoryTabs } from "./components/CategoryTabs";
import { ScriptWorkspace } from "./components/ScriptWorkspace";
import { StagePanel } from "./components/StagePanel";
import { Topbar } from "./components/Topbar";
import { useScratchApp } from "./hooks/useScratchApp";

export function App() {
  const scratch = useScratchApp();

  return (
    <>
      <Topbar
        projectName={scratch.projectName}
        resetSprite={scratch.resetSprite}
        saveProject={scratch.saveProject}
        loadProject={scratch.loadSavedProject}
        runScript={scratch.runScript}
        stopScript={scratch.stopScript}
        setProjectName={scratch.setProjectName}
        voiceListening={scratch.voiceListening}
      />

      <main className="workspace">
        <aside className="sidebar">
          <h2>Blocks</h2>
          <CategoryTabs category={scratch.category} onChange={scratch.setCategory} />
          <div className="palette" aria-label="Block palette">
            {scratch.paletteBlocks.map((block) => (
              <Block key={block.id} block={block} paletteBlock onAdd={scratch.addToScript} />
            ))}
          </div>
          <p className="hint">Drag blocks into the script, or click them to add them.</p>
        </aside>

        <section className="scripts-panel">
          <div className="panel-heading">
            <h2>Code</h2>
            <button className="text-button" onClick={scratch.clearBlocks}>Clear</button>
          </div>
          <ScriptWorkspace
            activeBlockId={scratch.activeBlockId}
            blocks={scratch.blocks}
            dragOver={scratch.dragOver}
            onAdd={scratch.addToScript}
            onBlockInputChange={scratch.updateBlockInput}
            onConditionDrop={scratch.dropCondition}
            onConditionInputChange={scratch.updateConditionInput}
            onDeleteBlock={scratch.deleteBlock}
            onDragLeave={() => scratch.setDragOver(false)}
            onDragOver={() => scratch.setDragOver(true)}
            onDrop={scratch.handleDrop}
          />
        </section>

        <StagePanel
          position={scratch.position}
          resetSprite={scratch.resetSprite}
          setSpriteName={scratch.setSpriteName}
          speech={scratch.speech}
          spriteHidden={scratch.spriteHidden}
          spriteName={scratch.spriteName}
          status={scratch.status}
        />
      </main>

      <section className="serial-console" aria-label="Arduino serial monitor">
        <div className="serial-header">
          <h2>Arduino Serial</h2>
          <button className="secondary" onClick={scratch.clearSerial}>Clear</button>
        </div>
        <div className="serial-output" role="log" aria-live="polite">
          {scratch.serialOutput.length === 0
            ? <span className="serial-empty">No serial output yet.</span>
            : scratch.serialOutput.map((line, index) => (
              <div key={`${index}-${line}`}>{line}</div>
            ))}
        </div>
      </section>

      <footer>Everything runs locally in your browser. Projects are saved in this browser.</footer>
    </>
  );
}
