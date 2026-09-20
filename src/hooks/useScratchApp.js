import { useMemo, useRef, useState } from "react";
import { blockDefinitions, defaultInputs, findDefinition } from "../data/blocks";
import { blockFromDrop, defaultConditionBlock, makeId, createCondition, isAIValue, createAIValue } from "../utils/blockHelpers";
import {
  askAI,
  generateImage,
  moveSprite,
  wait,
  connectArduino,
  isKeyPressed,
  disconnectArduino,
  sendArduino,
  isArduinoConnected,
  startListening,
  stopListening,
  waitForPhrase,
  isSpeechRecognitionSupported,
} from "../utils/runtime";

const initialPosition = { x: 50, y: 52, rotation: 0 };


export function useScratchApp() {
  const [category, setCategory] = useState("motion");
  const [projectName, setProjectName] = useState("My project");
  const [spriteName, setSpriteName] = useState("Cat");
  const [spriteImage, setSpriteImage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [spriteHidden, setSpriteHidden] = useState(false);
  const [speech, setSpeech] = useState("");
  const [status, setStatus] = useState("Ready");
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [arduinoConnected, setArduinoConnected] = useState(isArduinoConnected());
  const [serialOutput, setSerialOutput] = useState([]);
  const [voiceListening, setVoiceListening] = useState(false);
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

  function getControlBodyEnd(startIndex) {
    for (let i = startIndex; i < blocks.length; i++) {
      if (blocks[i].category === "control" || blocks[i].category === "voice") {
        return i;
      }
    }
    return blocks.length;
  }

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
      condition: ["if", "waitUntil"].includes(type) ? defaultConditionBlock() : null,
      children: ["repeat", "forever", "if", "waitUntil", "whenHear"].includes(type) ? [] : undefined,
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

  function dropAIValue(blockId, inputIndex, kind) {
    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, blockId, (block) => ({
        ...block,
        inputs: block.inputs.map((input, index) => (index === inputIndex ? createAIValue(kind) : input)),
      })),
    );
  }

  function updateAIPrompt(blockId, inputIndex, prompt) {
    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, blockId, (block) => ({
        ...block,
        inputs: block.inputs.map((input, index) =>
          index === inputIndex && isAIValue(input) ? { ...input, prompt, lastAnswer: null } : input,
        ),
      })),
    );
  }

  // Reverts an AI-driven slot back to a plain typed value.
  function clearAIValue(blockId, inputIndex, defaultValue) {
    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, blockId, (block) => ({
        ...block,
        inputs: block.inputs.map((input, index) => (index === inputIndex ? defaultValue : input)),
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
    setSpriteImage(null);
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
      spriteImage,
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
    setSpriteImage(project.spriteImage || null);
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
        : ["repeat", "forever", "if", "waitUntil"].includes(item.type)
          ? []
          : undefined,
    };
  }

  function hydrateSavedCondition(item) {
    if (!item.condition) {
      return ["if", "waitUntil"].includes(item.type)
        ? defaultConditionBlock()
        : null;
    }

    return hydrateCondition(item.condition);
  }

  async function resolveFirstValue(block) {
    const raw = block.inputs?.[0];

    if (!isAIValue(raw)) return raw;

    setStatus("Asking AI\u2026");
    const answer = await askAI(raw.prompt, raw.kind);
    const resolved = raw.kind === "number" ? Number(answer) : answer;
    const displayAnswer = raw.kind === "number" ? String(Number.isNaN(resolved) ? 0 : resolved) : answer;

    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, block.id, (currentBlock) => ({
        ...currentBlock,
        inputs: currentBlock.inputs.map((input, index) =>
          index === 0 && isAIValue(input) ? { ...input, lastAnswer: displayAnswer } : input,
        ),
      })),
    );

    return raw.kind === "number" ? (Number.isNaN(resolved) ? 0 : resolved) : resolved;
  }

  async function executeBlock(block, currentPosition) {
    const firstValue = await resolveFirstValue(block);
    let conditionResult;

    if (block.type === "move") {
      return { position: moveSprite(currentPosition, Number(firstValue || 10)), value: firstValue };
    }

    if (block.type === "generateImage") {
      setStatus("Generating image...");
      const image = await generateImage(firstValue);
      setSpriteImage(image);
      setStatus("Image generated");
    }

    if (block.type === "turn") {
      return {
        position: { ...currentPosition, rotation: currentPosition.rotation + Number(firstValue || 15) },
        value: firstValue,
      };
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
    if (block.type === "keyPressed") {
      return { position: currentPosition, value: isKeyPressed(firstValue) };
    }
    if (block.type === "repeat") {
      setStatus(`Repeat ${firstValue || 2} times`);
    }
    if (block.type === "if") {
      conditionResult = await resolveConditionToBoolean(block.id, block.condition);
      setStatus(conditionResult ? "If condition is true" : "If condition is false");
    }
    if (block.type === "askAI") {
      setStatus("Asking AI\u2026");
      const answer = await askAI(firstValue, "text");
      setSpeech(answer);
      setStatus("Running");
    }

    if (block.type === "arduinoConnect") {
      await connectArduino(setSerialOutput);
      setArduinoConnected(true);
      setStatus("Arduino connected");
      return { position: currentPosition, value: firstValue };
    }

    if (block.type === "waitUntil") {
      setStatus("Waiting for condition");
      while (runningRef.current && !(await resolveConditionToBoolean(block.id, block.condition))) {
        await wait(0.1);
      }

      const conditionMet = runningRef.current;
      if (runningRef.current) {
        setStatus("Condition is true");
        if (Array.isArray(block.children) && block.children.length > 0) {
          currentPosition = await executeBlockList(block.children, currentPosition);
        }
      }

      return { position: currentPosition, value: conditionMet };
    }

    if (block.type === "arduinoSend") {
      const message = firstValue ?? "";
      await sendArduino(message, setSerialOutput);
      setStatus(`Sent to Arduino: ${message}`);
      return { position: currentPosition, value: firstValue };
    }

    if (block.type === "arduinoDisconnect") {
      await disconnectArduino();
      setArduinoConnected(false);
      setStatus("Arduino disconnected");
      return { position: currentPosition, value: firstValue };
    }

    if (block.type === "arduinoSetPin") {
      const pin = block.inputs?.[0] ?? 13;
      const state = block.inputs?.[1] ?? "HIGH";
      await sendArduino(`PIN ${pin} ${String(state).toUpperCase()}`, setSerialOutput);
      setStatus(`Pin ${pin} set to ${String(state).toUpperCase()}`);
      return { position: currentPosition, value: firstValue };
    }

    if (block.type === "arduinoTogglePin") {
      const pin = block.inputs?.[0] ?? 13;
      await sendArduino(`TOGGLE ${pin}`, setSerialOutput);
      setStatus(`Toggled pin ${pin}`);
      return { position: currentPosition, value: firstValue };
    }

    if (block.type === "arduinoBlink") {
      const pin = block.inputs?.[0] ?? 13;
      const duration = block.inputs?.[1] ?? 500;
      await sendArduino(`BLINK ${pin} ${duration}`, setSerialOutput);
      setStatus(`Blinking pin ${pin} for ${duration} ms`);
      return { position: currentPosition, value: firstValue };
    }

    if (block.type === "whenHear") {
      const targetPhrase = firstValue ?? "hello";
      setStatus(`Listening for "${targetPhrase}"...`);
      setVoiceListening(true);

      const heard = await waitForPhrase(targetPhrase, 30000); // 30 second timeout

      setVoiceListening(false);

      if (heard) {
        setStatus(`Heard "${targetPhrase}"!`);

        // Execute child blocks if phrase was heard
        const childBlocks = Array.isArray(block.children) && block.children.length > 0 ? block.children : [];
        if (childBlocks.length > 0) {
          currentPosition = await executeBlockList(childBlocks, currentPosition);
        }
      } else {
        setStatus(`Timeout: didn't hear "${targetPhrase}"`);
      }

      return { position: currentPosition, value: firstValue };
    }

    return { position: currentPosition, value: firstValue, conditionResult };
}

async function executeBlockList(blockList, currentPosition) {
  let nextPosition = currentPosition;

  for (const nestedBlock of blockList) {
    if (!runningRef.current) break;

    setActiveBlockId(nestedBlock.id);
    const result = await executeBlock(nestedBlock, nextPosition);
    nextPosition = result.position;
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

  // Start voice listening if there are voice blocks
  const hasVoiceBlocks = blocks.some(block => block.category === "voice");
  if (hasVoiceBlocks && isSpeechRecognitionSupported()) {
    try {
      startListening();
      setVoiceListening(true);
    } catch (error) {
      console.error("Failed to start voice recognition:", error);
      setStatus("Voice recognition not available");
    }
  }

  let currentPosition = initialPosition;
  for (let index = 0; index < blocks.length; index += 1) {
    if (!runningRef.current) break;

    const block = blocks[index];
    setActiveBlockId(block.id);
    let result;
    try {
      result = await executeBlock(block, currentPosition);
    } catch (error) {
      console.error("Block execution failed:", error);
      setStatus(error?.message || "Block failed");
      runningRef.current = false;
      break;
    }
    currentPosition = result.position;
    setPosition(currentPosition);

    if (block.type === "repeat") {
      const repeatCount = Math.max(0, Math.floor(Number(result.value || 0)));
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

    if (block.type === "forever") {
      const hasNestedChildren = Array.isArray(block.children) && block.children.length > 0;
      const childBlocks = hasNestedChildren ? block.children : blocks.slice(index + 1);
      const bodyEndIndex = hasNestedChildren ? index + 1 : getControlBodyEnd(index + 1);
      const body = hasNestedChildren ? childBlocks : blocks.slice(index + 1, bodyEndIndex);

      while (runningRef.current && body.length > 0) {
        currentPosition = await executeBlockList(body, currentPosition);
      }

      if (!hasNestedChildren) {
        index = bodyEndIndex - 1;
      }
    }

    if (block.type === "if") {
      const childBlocks = Array.isArray(block.children) && block.children.length > 0 ? block.children : blocks.slice(index + 1);
      const bodyEndIndex = Array.isArray(block.children) && block.children.length > 0 ? index + 1 : getControlBodyEnd(index + 1);

      if (result.conditionResult) {
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
  setVoiceListening(false);
  stopListening();
  setStatus("Ready");
}

function stopScript() {
  runningRef.current = false;
  setActiveBlockId(null);
  setVoiceListening(false);
  stopListening();
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

function updateNestedConditionInputs(condition, conditionId, inputIndex, updater) {
  if (!condition) return condition;

  if (condition.id === conditionId) {
    return {
      ...condition,
      inputs: condition.inputs.map((input, index) => (index === inputIndex ? updater(input) : input)),
    };
  }

  if (condition.condition) {
    return {
      ...condition,
      condition: updateNestedConditionInputs(condition.condition, conditionId, inputIndex, updater),
    };
  }

  return condition;
}

function updateNestedConditionSelf(condition, conditionId, updater) {
  if (!condition) return condition;
  if (condition.id === conditionId) return updater(condition);

  if (condition.condition) {
    return { ...condition, condition: updateNestedConditionSelf(condition.condition, conditionId, updater) };
  }

  return condition;
}

function dropConditionAIValue(blockId, conditionId, inputIndex, kind) {
  setBlocks((currentBlocks) =>
    updateBlockTree(currentBlocks, blockId, (block) => ({
      ...block,
      condition: updateNestedConditionInputs(block.condition, conditionId, inputIndex, () => createAIValue(kind)),
    }))
  );
}

function updateConditionAIPrompt(blockId, conditionId, inputIndex, prompt) {
  setBlocks((currentBlocks) =>
    updateBlockTree(currentBlocks, blockId, (block) => ({
      ...block,
      condition: updateNestedConditionInputs(block.condition, conditionId, inputIndex, (input) =>
        isAIValue(input) ? { ...input, prompt, lastAnswer: null } : input,
      ),
    }))
  );
}

function clearConditionAIValue(blockId, conditionId, inputIndex, defaultValue) {
  setBlocks((currentBlocks) =>
    updateBlockTree(currentBlocks, blockId, (block) => ({
      ...block,
      condition: updateNestedConditionInputs(block.condition, conditionId, inputIndex, () => defaultValue),
    }))
  );
}

async function resolveConditionInputValue(blockId, condition, index) {
  const raw = condition.inputs?.[index];
  if (!isAIValue(raw)) return raw;

  setStatus("Asking AI\u2026");
  const answer = await askAI(raw.prompt, raw.kind);
  const resolved = raw.kind === "number" ? Number(answer) : answer;
  const displayAnswer = raw.kind === "number" ? String(Number.isNaN(resolved) ? 0 : resolved) : answer;

  setBlocks((currentBlocks) =>
    updateBlockTree(currentBlocks, blockId, (block) => ({
      ...block,
      condition: updateNestedConditionInputs(block.condition, condition.id, index, (input) =>
        isAIValue(input) ? { ...input, lastAnswer: displayAnswer } : input,
      ),
    })),
  );

  return raw.kind === "number" ? (Number.isNaN(resolved) ? 0 : resolved) : resolved;
}

async function resolveConditionToBoolean(blockId, condition) {
  if (!condition) return false;

  if (condition.type === "not") {
    return !(await resolveConditionToBoolean(blockId, condition.condition));
  }

  if (condition.type === "aiCondition") {
    const prompt = await resolveConditionInputValue(blockId, condition, 0);
    setStatus("Asking AI\u2026");
    const answer = await askAI(String(prompt ?? ""), "boolean");

    setBlocks((currentBlocks) =>
      updateBlockTree(currentBlocks, blockId, (block) => ({
        ...block,
        condition: updateNestedConditionSelf(block.condition, condition.id, (node) => ({ ...node, lastAnswer: answer })),
      })),
    );

    return /^(true|yes)/i.test(String(answer).trim());
  }

  if (condition.type === "greaterThan" || condition.type === "lessThan") {
    const left = await resolveConditionInputValue(blockId, condition, 0);
    const right = await resolveConditionInputValue(blockId, condition, 1);
    return condition.type === "greaterThan" ? Number(left || 0) > Number(right || 0) : Number(left || 0) < Number(right || 0);
  }

  if (condition.type === "keyPressed") {
    const key = await resolveConditionInputValue(blockId, condition, 0);
    return isKeyPressed(key);
  }

  return false;
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
  spriteImage,
  status,
  stopScript,
  updateBlockInput,
  updateConditionInput,
  dropAIValue,
  updateAIPrompt,
  clearAIValue,
  dropConditionAIValue,
  updateConditionAIPrompt,
  clearConditionAIValue,

  arduinoConnected,
  serialOutput,
  clearSerial: () => setSerialOutput([]),
  voiceListening,

  connectArduino: async () => {
    try {
      await connectArduino(setSerialOutput);
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