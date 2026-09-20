// import { blockDefinitions, defaultInputs } from "../data/blocks";

// export function makeId() {
//   return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
// }

// export function defaultConditionBlock() {
//   const definition = blockDefinitions.condition[0];

//   return {
//     id: makeId(),
//     type: definition.type,
//     category: "condition",
//     inputs: defaultInputs(definition),
//   };
// }

// export function evaluateCondition(condition) {
//   if (!condition) return false;

//   if (condition.type === "greaterThan") {
//     return Number(condition.inputs[0] || 0) > Number(condition.inputs[1] || 0);
//   }
//   if (condition.type === "lessThan") {
//     return Number(condition.inputs[0] || 0) < Number(condition.inputs[1] || 0);
//   }

//   return false;
// }

// export function blockFromDrop(event) {
//   const raw = event.dataTransfer.getData("text/plain");
//   if (!raw) return null;

//   try {
//     return JSON.parse(raw);
//   } catch {
//     return null;
//   }
// }
import { blockDefinitions, defaultInputs } from "../data/blocks";

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function createCondition(type = "greaterThan") {
  const definition = blockDefinitions.condition.find(
    (definition) => definition.type === type
  );

  if (!definition) return null;

  const condition = {
    id: makeId(),
    type: definition.type,
    category: "condition",
    inputs: defaultInputs(definition),
  };

  if (type === "not") {
    condition.condition = createCondition("greaterThan");
  }

  return condition;
}

export function defaultConditionBlock() {
  return createCondition("greaterThan");
}

export function evaluateCondition(condition, isKeyPressed) {
  if (!condition) return false;

  if (condition.type === "greaterThan") {
    return (
      Number(condition.inputs[0] || 0) >
      Number(condition.inputs[1] || 0)
    );
  }

  if (condition.type === "lessThan") {
    return (
      Number(condition.inputs[0] || 0) <
      Number(condition.inputs[1] || 0)
    );
  }

  if (condition.type === "keyPressed") {
    return isKeyPressed(condition.inputs[0]);
  }

  if (condition.type === "not") {
    return !evaluateCondition(condition.condition, isKeyPressed);
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