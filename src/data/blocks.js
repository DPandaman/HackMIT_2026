export const blockDefinitions = {
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
    {
      type: "lessThan",
      template: [
        { value: "1", type: "number", min: "0", step: "0.1" },
        " < ",
        { value: "2", type: "number", min: "0", step: "0.1" },
      ],
    },
  ],
  events: [{ type: "flag", template: ["when 🚩 clicked"] }],
};

export const categoryLabels = {
  motion: "Motion",
  looks: "Looks",
  control: "Control",
  events: "Events",
  condition: "Condition",
};

export function findDefinition(category, type) {
  return blockDefinitions[category]?.find((definition) => definition.type === type);
}

export function defaultInputs(definition) {
  return definition.template.filter((part) => typeof part === "object").map((part) => part.value);
}
