import { blockDefinitions, defaultInputs } from "../data/blocks";

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function defaultConditionBlock() {
  const definition = blockDefinitions.condition[0];

  return {
    id: makeId(),
    type: definition.type,
    category: "condition",
    inputs: defaultInputs(definition),
  };
}

export function evaluateCondition(condition) {
  if (!condition) return false;

  if (condition.type === "greaterThan") {
    return Number(condition.inputs[0] || 0) > Number(condition.inputs[1] || 0);
  }

  return false;
}

export function blockFromDrop(event) {
  const raw = event.dataTransfer.getData("text/plain");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
