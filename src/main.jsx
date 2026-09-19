import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";

const blockDefinitions = {
  motion: [
    { type: "move", template: ["move ", { value: "10", type: "number" }, " steps"] },
    { type: "turn", template: ["turn ", { value: "15", type: "number" }, " degrees"] },
  ],
  looks: [
    { type: "say", template: ["say ", { value: "Hello!", type: "text" }] },
    { type: "hide", template: ["hide sprite"] },
  ],
  control: [
    { type: "wait", template: ["wait ", { value: "1", type: "number", min: "0", step: "0.1" }, " seconds"] },
    { type: "repeat", template: ["repeat ", { value: "2", type: "number", min: "1" }, " times"] },
    { type: "if", template: ["if ", { socket: "condition" }, " then"] },
  ],
  condition: [
    {
      type: "greaterThan",
      template: [
        { value: "2", type: "number", min: "0", step: "0.1" },
        " > ",
        { value: "1", type: "number", min: "0", step: "0.1" },
      ],
    },
  ],
  events: [{ type: "flag", template: ["when 🚩 clicked"] }],
};

const categoryLabels = {
  motion: "Motion",
  looks: "Looks",
  control: "Control",
  events: "Events",
  condition: "Condition",
};

const initialPosition = { x: 50, y: 52, rotation: 0 };

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function findDefinition(category, type) {
  return blockDefinitions[category]?.find((definition) => definition.type === type);
}

function defaultInputs(definition) {
  return definition.template.filter((part) => typeof part === "object").map((part) => part.value);
}

function defaultConditionBlock() {
  const definition = blockDefinitions.condition[0];

  return {
    id: makeId(),
    type: definition.type,
    category: "condition",
    inputs: defaultInputs(definition),
  };
}

function evaluateCondition(condition) {
  if (!condition) return false;

  if (condition.type === "greaterThan") {
    return Number(condition.inputs[0] || 0) > Number(condition.inputs[1] || 0);
  }

  return false;
}

function blockFromDrop(event) {
  const raw = event.dataTransfer.getData("text/plain");
  return raw ? JSON.parse(raw) : null;
}

function Block({
  block,
  paletteBlock = false,
  active = false,
  onAdd,
  onRemove,
  onInputChange,
  onConditionDrop,
  onConditionInputChange,
}) {
  const definition = findDefinition(block.category, block.type);
  let inputIndex = 0;
  const blockStyle = {
    ...(block.category === "condition" ? { background: "#ca2f2f", color: "white" } : {}),
    ...(active ? { outline: "3px solid white" } : {}),
  };

  if (!definition) return null;

  function handleDragStart(event) {
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: block.type, category: block.category }));
  }

  function renderConditionSocket(index) {
    if (paletteBlock) {
      return (
        <span key={index} style={{ opacity: 0.78 }}>
          &lt;condition&gt;
        </span>
      );
    }

    return (
      <span
        key={index}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const item = blockFromDrop(event);
          if (item?.category === "condition") onConditionDrop(block.id, item.type);
        }}
        style={{
          alignItems: "center",
          background: "#ffffff38",
          border: "2px dashed #ffffffb0",
          borderRadius: 5,
          display: "inline-flex",
          minHeight: 32,
          minWidth: 138,
          padding: "2px 5px",
          verticalAlign: "middle",
        }}
      >
        {block.condition ? (
          <Block
            block={block.condition}
            onInputChange={(conditionId, inputIndex, value) => onConditionInputChange(block.id, conditionId, inputIndex, value)}
          />
        ) : (
          <span style={{ color: "white", fontSize: ".8rem", opacity: 0.78 }}>drop condition</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`block ${block.category}`}
      style={blockStyle}
      draggable
      onClick={paletteBlock ? () => onAdd(block.type, block.category) : undefined}
      onDoubleClick={!paletteBlock && onRemove ? () => onRemove(block.id) : undefined}
      onDragStart={handleDragStart}
    >
      {definition.template.map((part, index) => {
        if (typeof part === "string") return <React.Fragment key={index}>{part}</React.Fragment>;
        if (part.socket === "condition") return renderConditionSocket(index);

        const currentIndex = inputIndex;
        inputIndex += 1;
        return (
          <input
            key={index}
            type={part.type}
            min={part.min}
            step={part.step}
            value={block.inputs[currentIndex] ?? part.value}
            readOnly={paletteBlock}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onInputChange(block.id, currentIndex, event.target.value)}
          />
        );
      })}
    </div>
  );
}

function App() {
  const [category, setCategory] = useState("motion");
  const [projectName, setProjectName] = useState("My project");
  const [spriteName, setSpriteName] = useState("Cat");
  const [blocks, setBlocks] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [spriteHidden, setSpriteHidden] = useState(false);
  const [speech, setSpeech] = useState("");
  const [status, setStatus] = useState("Ready");
  const [activeBlockId, setActiveBlockId] = useState(null);
  const runningRef = useRef(false);

  const paletteBlocks = useMemo(
    () =>
      blockDefinitions[category].map((definition) => ({
        id: `${category}-${definition.type}`,
        type: definition.type,
        category,
        inputs: defaultInputs(definition),
      })),
    [category],
  );

  function addToScript(type, blockCategory) {
    const definition = findDefinition(blockCategory, type);
    if (!definition) return;

    setBlocks((currentBlocks) => [
      ...currentBlocks,
      {
        id: makeId(),
        type,
        category: blockCategory,
        inputs: defaultInputs(definition),
        condition: type === "if" ? defaultConditionBlock() : null,
      },
    ]);
  }

  function updateBlockInput(id, inputIndex, value) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === id
          ? { ...block, inputs: block.inputs.map((input, index) => (index === inputIndex ? value : input)) }
          : block,
      ),
    );
  }

  function resetSprite() {
    setPosition(initialPosition);
    setSpriteHidden(false);
    setSpeech("");
  }

  function projectData() {
    return {
      name: projectName.trim(),
      spriteName,
      blocks: blocks.map(({ type, category: blockCategory, inputs, condition }) => ({
        type,
        category: blockCategory,
        inputs,
        condition: condition
          ? {
              type: condition.type,
              category: condition.category,
              inputs: condition.inputs,
            }
          : null,
      })),
    };
  }

  function loadProject(project) {
    setProjectName(project.name || "My project");
    setSpriteName(project.spriteName || "Cat");
    setBlocks(
      (project.blocks || [])
        .map((item) => {
          const definition = findDefinition(item.category, item.type);
          if (!definition) return null;
          const defaults = defaultInputs(definition);

          return {
            id: makeId(),
            type: item.type,
            category: item.category,
            inputs: defaults.map((input, index) => item.inputs?.[index] ?? input),
            condition: item.condition
              ? {
                  id: makeId(),
                  type: item.condition.type,
                  category: item.condition.category,
                  inputs: item.condition.inputs || [],
                }
              : item.type === "if"
                ? defaultConditionBlock()
                : null,
          };
        })
        .filter(Boolean),
    );
    resetSprite();
  }

  async function executeBlock(block, currentPosition) {
    const firstValue = block.inputs[0];

    if (block.type === "move") {
      const distance = Number(firstValue || 10);
      return {
        ...currentPosition,
        x: Math.max(4, Math.min(96, currentPosition.x + (Math.cos((currentPosition.rotation * Math.PI) / 180) * distance) / 4)),
        y: Math.max(8, Math.min(92, currentPosition.y + (Math.sin((currentPosition.rotation * Math.PI) / 180) * distance) / 4)),
      };
    }

    if (block.type === "turn") {
      return { ...currentPosition, rotation: currentPosition.rotation + Number(firstValue || 15) };
    }

    if (block.type === "say") {
      setSpeech(firstValue || "Hello!");
    }

    if (block.type === "hide") {
      setSpriteHidden(true);
    }

    if (block.type === "wait") {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(firstValue || 1)) * 1000));
    }

    if (block.type === "repeat") {
      setStatus(`Repeat ${firstValue || 2} is ready`);
    }

    if (block.type === "if") {
      setStatus(evaluateCondition(block.condition) ? "If condition is true" : "If condition is false");
    }

    return currentPosition;
  }

  async function runScript() {
    if (runningRef.current) return;

    runningRef.current = true;
    setStatus("Running");
    setActiveBlockId(null);
    resetSprite();

    let currentPosition = initialPosition;
    for (let index = 0; index < blocks.length; index += 1) {
      if (!runningRef.current) break;

      const block = blocks[index];
      setActiveBlockId(block.id);
      currentPosition = await executeBlock(block, currentPosition);
      setPosition(currentPosition);

      if (block.type === "if" && !evaluateCondition(block.condition)) {
        index += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    runningRef.current = false;
    setActiveBlockId(null);
    setStatus("Ready");
  }

  function stopScript() {
    runningRef.current = false;
    setActiveBlockId(null);
    setStatus("Stopped");
  }

  function saveProject() {
    localStorage.setItem("local-scratch-project", JSON.stringify(projectData()));
    setStatus("Saved locally");
  }

  function loadSavedProject() {
    const raw = localStorage.getItem("local-scratch-project");
    if (raw) loadProject(JSON.parse(raw));
    setStatus(raw ? "Loaded locally" : "No saved project");
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);
    const item = blockFromDrop(event);
    if (!item) return;
    addToScript(item.type, item.category);
  }

  function dropCondition(blockId, conditionType) {
    const definition = findDefinition("condition", conditionType);
    if (!definition) return;

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              condition: {
                id: makeId(),
                type: conditionType,
                category: "condition",
                inputs: defaultInputs(definition),
              },
            }
          : block,
      ),
    );
  }

  function updateConditionInput(blockId, conditionId, inputIndex, value) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId && block.condition?.id === conditionId
          ? {
              ...block,
              condition: {
                ...block.condition,
                inputs: block.condition.inputs.map((input, index) => (index === inputIndex ? value : input)),
              },
            }
          : block,
      ),
    );
  }

  return (
    <>
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
          <button className="secondary" onClick={loadSavedProject}>Load</button>
          <button className="run" onClick={runScript}>▶ Run</button>
          <button className="stop" onClick={stopScript}>■ Stop</button>
          <button className="stop" onClick={resetSprite}>Reset</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <h2>Blocks</h2>
          <div className="category-tabs" role="tablist" aria-label="Block categories">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <button
                key={key}
                className={`category${category === key ? " active" : ""}`}
                data-category={key}
                onClick={() => setCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="palette" aria-label="Block palette">
            {paletteBlocks.map((block) => (
              <Block key={block.id} block={block} paletteBlock onAdd={addToScript} />
            ))}
          </div>
          <p className="hint">Drag blocks into the script, or click them to add them.</p>
        </aside>

        <section className="scripts-panel">
          <div className="panel-heading">
            <h2>Code</h2>
            <button className="text-button" onClick={() => setBlocks([])}>Clear</button>
          </div>
          <div
            className={`script${dragOver ? " drag-over" : ""}`}
            aria-label="Script workspace"
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {blocks.length === 0 ? (
              <div className="drop-message">Drop blocks here to build your program</div>
            ) : (
              blocks.map((block) => (
                <Block
                  key={block.id}
                  block={block}
                  active={activeBlockId === block.id}
                  onRemove={(id) => setBlocks((currentBlocks) => currentBlocks.filter((item) => item.id !== id))}
                  onInputChange={updateBlockInput}
                  onConditionDrop={dropCondition}
                  onConditionInputChange={updateConditionInput}
                />
              ))
            )}
          </div>
        </section>

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
      </main>
      <footer>Everything runs locally in your browser. Projects are saved in this browser.</footer>
    </>
  );
}

createRoot(document.querySelector("#root")).render(<App />);
