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

    {
      type: "not",
      template: [
        "not ",
        { socket: "condition" },
      ],
    },
  ],

  events: [
    { type: "flag", template: ["when 🚩 clicked"] },
  ],
  hardware: [
    {
      type: "arduinoConnect",
      template: ["connect Arduino"],
    },

    {
      type: "arduinoDisconnect",
      template: ["disconnect Arduino"],
    },

    {
      type: "arduinoSend",
      template: [
        "send ",
        { value: "HELLO", type: "text" },
        " to Arduino",
      ],
    },

    {
      type: "arduinoSetPin",
      template: [
        "set pin ",
        { value: "13", type: "number", min: "0" },
        " to ",
        { value: "HIGH", type: "text" },
      ],
    },

    {
      type: "arduinoTogglePin",
      template: [
        "toggle pin ",
        { value: "13", type: "number", min: "0" },
      ],
    },

    {
      type: "arduinoBlink",
      template: [
        "blink pin ",
        { value: "13", type: "number", min: "0" },
        " for ",
        { value: "500", type: "number", min: "0" },
        " ms",
      ],
    },
  ],
  ai: [
    {
      type: "askAI",
      template: ["ask AI ", { value: "What should the sprite say?", type: "text" }, " and say the answer"],
    },
  ],

  voice: [
    {
      type: "whenHear",
      template: ["when I hear ", { value: "hello", type: "text" }],
      isEvent: true,
    },
  ],
};

export const categoryLabels = {
  motion: "Motion",
  looks: "Looks",
  control: "Control",
  events: "Events",
  condition: "Condition",
  hardware: "Hardware",
  ai: "AI",
  voice: "Voice",
};

export function findDefinition(category, type) {
  return blockDefinitions[category]?.find(
    (definition) => definition.type === type
  );
}

export function defaultInputs(definition) {
  return definition.template
    .filter(
      (part) =>
        typeof part === "object" &&
        Object.prototype.hasOwnProperty.call(part, "value")
    )
    .map((part) => part.value);
}