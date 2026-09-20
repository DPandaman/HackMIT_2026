import { useMemo, useRef, useState } from "react";
import { blockDefinitions, defaultInputs, findDefinition } from "../data/blocks";
import { blockFromDrop, defaultConditionBlock, evaluateCondition, makeId, createCondition } from "../utils/blockHelpers";
import { moveSprite, wait, connectArduino, disconnectArduino, sendArduino, isArduinoConnected, } from "../utils/runtime";

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
  const [arduinoConnected, setArduinoConnected] = useState(isArduinoConnected());
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

  function appendBlockToTree(blocks, parentId, newBlock) {
    if (!parentId) return [...blocks, newBlock];

    return blocks.map((block) => {
      if (block.id === parentId) {
        return {
          ...block,
          children: [...(Array.isArray(block.children) ? block.children : []), newBlock],
        };
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        return {
          ...block,
          children: appendBlockToTree(block.children, parentId, newBlock),
        };
      }

      return block;
    });
  }

  function updateBlockTree(blocks, blockId, updater) {
    return blocks.map((block) => {
      if (block.id === blockId) return updater(block);

      if (Array.isArray(block.children) && block.children.length > 0) {
        return {
          ...block,
          children: updateBlockTree(block.children, blockId, updater),
        };
      }

      return block;
    });
  }

  function removeBlockTree(blocks, blockId) {
    return blocks.flatMap((block) => {
      if (block.id === blockId) return [];

      if (Array.isArray(block.children) && block.children.length > 0) {
        return [{ ...block, children: removeBlockTree(block.children, blockId) }];
      }

      return [block];
    });
  }

  function addToScript(type, blockCategory, parentId = null) {
    const definition = findDefinition(blockCategory, type);
    if (!definition) return;

    const newBlock = {
      id: makeId(),
      type,
      category: blockCategory,
      inputs: defaultInputs(definition),
      condition: type === "if" ? defaultConditionBlock() : null,
      children: ["repeat", "if"].includes(type) ? [] : undefined,
    };

    setBlocks((currentBlocks) =>
      parentId ? appendBlockToTree(currentBlocks, parentId, newBlock) : [...currentBlocks, newBlock],
    );
  }

  function updateBlockInput(id, inputIndex, value) {
    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, id, (block) => ({
        ...block,
        inputs: block.inputs.map((input, index) => (index === inputIndex ? value : input)),
      })),
    );
  }

  function deleteBlock(id) {
    setBlocks((currentBlocks) => removeBlockTree(currentBlocks, id));
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


  function serializeBlock(block) {
    return {
      type: block.type,
      category: block.category,
      inputs: block.inputs,
      condition: serializeCondition(block.condition),
      children: Array.isArray(block.children)
        ? block.children.map((child) => serializeBlock(child))
        : undefined,
    };
  }

  function projectData() {
    return {
      name: projectName.trim(),
      spriteName,
      blocks: blocks.map((block) => serializeBlock(block)),
    };
  }

  function hydrateCondition(condition) {
    if (!condition) return null;

    const definition = findDefinition(
      condition.category,
      condition.type
    );

    if (!definition) return null;

    const defaults = defaultInputs(definition);

    return {
      id: makeId(),
      type: condition.type,
      category: condition.category,
      inputs: defaults.map(
        (input, index) => condition.inputs?.[index] ?? input
      ),
      condition: hydrateCondition(condition.condition),
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
      children: Array.isArray(item.children)
        ? item.children.map((child) => hydrateSavedBlock(child)).filter(Boolean)
        : ["repeat", "if"].includes(item.type)
          ? []
          : undefined,
    };
  }

  function hydrateSavedCondition(item) {
    if (!item.condition) {
      return item.type === "if"
        ? defaultConditionBlock()
        : null;
    }

    return hydrateCondition(item.condition);
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
      setStatus(`Repeat ${firstValue || 2} times`);
    }
    if (block.type === "if") {
      setStatus(evaluateCondition(block.condition) ? "If condition is true" : "If condition is false");
    }

    if (block.type === "arduinoConnect") {
      await connectArduino();
      setArduinoConnected(true);
      setStatus("Arduino connected");
      return currentPosition;
    }

    if (block.type === "arduinoSend") {
      const message = block.inputs?.[0] ?? "";
      await sendArduino(message);
      setStatus(`Sent to Arduino: ${message}`);
      return currentPosition;
    }

    if (block.type === "arduinoDisconnect") {
      await disconnectArduino();
      setArduinoConnected(false);
      setStatus("Arduino disconnected");
      return currentPosition;
    }

    return currentPosition;
  }

  async function executeBlockList(blockList, currentPosition) {
    let nextPosition = currentPosition;

    for (const nestedBlock of blockList) {
      if (!runningRef.current) break;

      setActiveBlockId(nestedBlock.id);
      nextPosition = await executeBlock(nestedBlock, nextPosition);
      setPosition(nextPosition);
      await wait(0.25);
    }

    return nextPosition;
  }

  async function executeRepeatedBlock(blockList, currentPosition, count) {
    let nextPosition = currentPosition;

    for (let iteration = 0; iteration < count; iteration += 1) {
      if (!runningRef.current) break;
      nextPosition = await executeBlockList(blockList, nextPosition);
    }

    return nextPosition;
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

      if (block.type === "repeat") {
        const repeatCount = Math.max(0, Math.floor(Number(block.inputs[0] || 0)));
        const childBlocks = Array.isArray(block.children) && block.children.length > 0 ? block.children : blocks.slice(index + 1);
        const bodyEndIndex = Array.isArray(block.children) && block.children.length > 0 ? index + 1 : getControlBodyEnd(index + 1);

        if (repeatCount > 0 && childBlocks.length > 0) {
          const body = Array.isArray(block.children) && block.children.length > 0
            ? block.children
            : blocks.slice(index + 1, bodyEndIndex);
          currentPosition = await executeRepeatedBlock(body, currentPosition, repeatCount);

          if (!Array.isArray(block.children) || block.children.length === 0) {
            index = bodyEndIndex - 1;
          }
        }
      }

      if (block.type === "if") {
        const childBlocks = Array.isArray(block.children) && block.children.length > 0 ? block.children : blocks.slice(index + 1);
        const bodyEndIndex = Array.isArray(block.children) && block.children.length > 0 ? index + 1 : getControlBodyEnd(index + 1);

        if (evaluateCondition(block.condition)) {
          if (childBlocks.length > 0) {
            const body = Array.isArray(block.children) && block.children.length > 0
              ? block.children
              : blocks.slice(index + 1, bodyEndIndex);
            currentPosition = await executeBlockList(body, currentPosition);
          }
        } else if (!Array.isArray(block.children) || block.children.length === 0) {
          index = bodyEndIndex - 1;
        }
      }

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

  function replaceConditionInside(
    condition,
    targetConditionId,
    newCondition
  ) {
    if (!condition) return condition;

    if (
      condition.id === targetConditionId &&
      condition.type === "not"
    ) {
      return {
        ...condition,
        condition: newCondition,
      };
    }

    if (condition.condition) {
      return {
        ...condition,
        condition: replaceConditionInside(
          condition.condition,
          targetConditionId,
          newCondition
        ),
      };
    }

    return condition;
  }

  function serializeCondition(condition) {
    if (!condition) return null;

    return {
      type: condition.type,
      category: condition.category,
      inputs: condition.inputs,
      condition: serializeCondition(condition.condition),
    };
  }


  function dropCondition(
    blockId,
    conditionType,
    targetConditionId = null
  ) {
    const newCondition = createCondition(conditionType);

    if (!newCondition) return;

    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, blockId, (block) => {
        if (!targetConditionId) {
          return {
            ...block,
            condition: newCondition,
          };
        }

        return {
          ...block,
          condition: replaceConditionInside(
            block.condition,
            targetConditionId,
            newCondition
          ),
        };
      })
    );
  }

  function updateNestedCondition(
    condition,
    conditionId,
    inputIndex,
    value
  ) {
    if (!condition) return condition;

    if (condition.id === conditionId) {
      return {
        ...condition,
        inputs: condition.inputs.map((input, index) =>
          index === inputIndex ? value : input
        ),
      };
    }

    if (condition.condition) {
      return {
        ...condition,
        condition: updateNestedCondition(
          condition.condition,
          conditionId,
          inputIndex,
          value
        ),
      };
    }

    return condition;
  }

  function updateConditionInput(
    blockId,
    conditionId,
    inputIndex,
    value
  ) {
    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, blockId, (block) => ({
        ...block,
        condition: updateNestedCondition(
          block.condition,
          conditionId,
          inputIndex,
          value
        ),
      }))
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

    arduinoConnected,

    connectArduino: async () => {
      try {
        await connectArduino();
        setArduinoConnected(true);
        setStatus("Arduino connected");
      } catch (error) {
        setStatus(error?.message || "Could not connect Arduino");
      }
    },

    disconnectArduino: async () => {
      try {
        await disconnectArduino();
        setArduinoConnected(false);
        setStatus("Arduino disconnected");
      } catch (error) {
        setStatus(error?.message || "Could not disconnect Arduino");
      }
    },
  };
}
