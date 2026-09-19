import { useMemo, useRef, useState } from "react";
import { blockDefinitions, defaultInputs, findDefinition } from "../data/blocks";
import { blockFromDrop, defaultConditionBlock, evaluateCondition, makeId } from "../utils/blockHelpers";
import { moveSprite, wait } from "../utils/runtime";

const initialPosition = { x: 50, y: 52, rotation: 0 };

export function useScratchApp() {
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

  function deleteBlock(id) {
    setBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  }

  function clearBlocks() {
    setBlocks([]);
    setActiveBlockId(null);
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
    setBlocks((project.blocks || []).map(hydrateSavedBlock).filter(Boolean));
    resetSprite();
  }

  function hydrateSavedBlock(item) {
    const definition = findDefinition(item.category, item.type);
    if (!definition) return null;

    const defaults = defaultInputs(definition);
    return {
      id: makeId(),
      type: item.type,
      category: item.category,
      inputs: defaults.map((input, index) => item.inputs?.[index] ?? input),
      condition: hydrateSavedCondition(item),
    };
  }

  function hydrateSavedCondition(item) {
    if (!item.condition) return item.type === "if" ? defaultConditionBlock() : null;

    return {
      id: makeId(),
      type: item.condition.type,
      category: item.condition.category,
      inputs: item.condition.inputs || [],
    };
  }

  async function executeBlock(block, currentPosition) {
    const firstValue = block.inputs[0];

    if (block.type === "move") {
      return moveSprite(currentPosition, Number(firstValue || 10));
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
      await wait(Number(firstValue || 1));
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

      if (block.type === "if" && !evaluateCondition(block.condition)) index += 1;
      await wait(0.25);
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
    if (!raw) {
      setStatus("No saved project");
      return;
    }

    try {
      loadProject(JSON.parse(raw));
      setStatus("Loaded locally");
    } catch {
      setStatus("Could not load project");
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);

    const item = blockFromDrop(event);
    if (item) addToScript(item.type, item.category);
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

  return {
    activeBlockId,
    addToScript,
    blocks,
    category,
    clearBlocks,
    deleteBlock,
    dragOver,
    dropCondition,
    handleDrop,
    loadSavedProject,
    paletteBlocks,
    position,
    projectName,
    resetSprite,
    runScript,
    saveProject,
    setCategory,
    setDragOver,
    setProjectName,
    setSpriteName,
    speech,
    spriteHidden,
    spriteName,
    status,
    stopScript,
    updateBlockInput,
    updateConditionInput,
  };
}
