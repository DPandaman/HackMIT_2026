const blockDefinitions = {
  motion: [
    { type: "move", label: "move <input value=\"10\" type=\"number\"> steps" },
    { type: "turn", label: "turn <input value=\"15\" type=\"number\"> degrees" },
  ],
  looks: [
    { type: "say", label: "say <input value=\"Hello!\" type=\"text\">" },
    { type: "hide", label: "hide sprite" },
  ],
  control: [
    { type: "wait", label: "wait <input value=\"1\" type=\"number\" min=\"0\" step=\"0.1\"> seconds" },
    { type: "repeat", label: "repeat <input value=\"2\" type=\"number\" min=\"1\"> times" },
  ],
  events: [{ type: "flag", label: "when 🚩 clicked" }],
};

const palette = document.querySelector("#palette");
const script = document.querySelector("#script");
const stage = document.querySelector("#stage");
const sprite = document.querySelector("#sprite");
const speech = document.querySelector("#speech");
const status = document.querySelector("#status");
let category = "motion";
let running = false;
let position = { x: 50, y: 52, rotation: 0 };
let savedProject = null;

function renderPalette() {
  palette.innerHTML = "";
  blockDefinitions[category].forEach((definition) => palette.appendChild(createBlock(definition, category, true)));
}

function createBlock(definition, blockCategory, paletteBlock = false) {
  const block = document.createElement("div");
  block.className = `block ${blockCategory}`;
  block.dataset.type = definition.type;
  block.dataset.category = blockCategory;
  block.innerHTML = definition.label;
  block.draggable = true;
  block.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: definition.type, category: blockCategory }));
  });
  if (paletteBlock) block.addEventListener("click", () => addToScript(definition.type, blockCategory));
  return block;
}

function addToScript(type, blockCategory) {
  const definition = blockDefinitions[blockCategory].find((item) => item.type === type);
  const block = createBlock(definition, blockCategory);
  block.addEventListener("dblclick", () => block.remove());
  script.querySelector(".drop-message")?.remove();
  script.appendChild(block);
}

function resetSprite() {
  position = { x: 50, y: 52, rotation: 0 };
  sprite.style.left = `${position.x}%`;
  sprite.style.top = `${position.y}%`;
  sprite.style.transform = `translate(-50%, -50%) rotate(${position.rotation}deg)`;
  sprite.hidden = false;
  speech.hidden = true;
}

function value(block, selector, fallback) {
  const input = block.querySelector(selector);
  return input ? input.value : fallback;
}

async function executeBlock(block) {
  const type = block.dataset.type;
  if (type === "move") {
    const distance = Number(value(block, "input", 10));
    position.x = Math.max(4, Math.min(96, position.x + Math.cos(position.rotation * Math.PI / 180) * distance / 4));
    position.y = Math.max(8, Math.min(92, position.y + Math.sin(position.rotation * Math.PI / 180) * distance / 4));
  } else if (type === "turn") {
    position.rotation += Number(value(block, "input", 15));
  } else if (type === "say") {
    speech.textContent = value(block, "input", "Hello!");
    speech.hidden = false;
  } else if (type === "hide") {
    sprite.hidden = true;
  } else if (type === "wait") {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(value(block, "input", 1))) * 1000));
  } else if (type === "repeat") {
    status.textContent = `Repeat ${value(block, "input", 2)} is ready`;
  }
  sprite.style.left = `${position.x}%`;
  sprite.style.top = `${position.y}%`;
  sprite.style.transform = `translate(-50%, -50%) rotate(${position.rotation}deg)`;
}

async function runScript() {
  if (running) return;
  running = true;
  status.textContent = "Running";
  resetSprite();
  for (const block of [...script.querySelectorAll(".block")]) {
    if (!running) break;
    block.style.outline = "3px solid white";
    await executeBlock(block);
    block.style.outline = "";
  }
  running = false;
  status.textContent = "Ready";
}

async function reset() {
  resetSprite();
}

function projectData() {
  return {
    name: document.querySelector(".project-name").textContent.trim(),
    spriteName: document.querySelector("#sprite-name").value,
    blocks: [...script.querySelectorAll(".block")].map((block) => ({
      type: block.dataset.type,
      category: block.dataset.category,
      inputs: [...block.querySelectorAll("input")].map((input) => input.value),
    })),
  };
}

function loadProject(project) {
  document.querySelector(".project-name").textContent = project.name || "My project";
  document.querySelector("#sprite-name").value = project.spriteName || "Cat";
  script.innerHTML = "";
  (project.blocks || []).forEach((item) => {
    addToScript(item.type, item.category);
    const block = script.lastElementChild;
    block.querySelectorAll("input").forEach((input, index) => { input.value = item.inputs[index] ?? input.value; });
  });
  if (!script.children.length) script.innerHTML = '<div class="drop-message">Drop blocks here to build your program</div>';
  resetSprite();
}

document.querySelectorAll(".category").forEach((button) => button.addEventListener("click", () => {
  document.querySelector(".category.active").classList.remove("active");
  button.classList.add("active");
  category = button.dataset.category;
  renderPalette();
}));
script.addEventListener("dragover", (event) => { event.preventDefault(); script.classList.add("drag-over"); });
script.addEventListener("dragleave", () => script.classList.remove("drag-over"));
script.addEventListener("drop", (event) => {
  event.preventDefault();
  script.classList.remove("drag-over");
  const item = JSON.parse(event.dataTransfer.getData("text/plain"));
  addToScript(item.type, item.category);
});
document.querySelector("#run-button").addEventListener("click", runScript);
document.querySelector("#reset-button").addEventListener("click", reset);
document.querySelector("#stop-button").addEventListener("click", () => { running = false; status.textContent = "Stopped"; });
document.querySelector("#reset-button").addEventListener("click", resetSprite);
document.querySelector("#clear-button").addEventListener("click", () => {
  script.innerHTML = '<div class="drop-message">Drop blocks here to build your program</div>';
});
document.querySelector("#save-button").addEventListener("click", () => {
  savedProject = projectData();
  localStorage.setItem("local-scratch-project", JSON.stringify(savedProject));
  status.textContent = "Saved locally";
});
document.querySelector("#load-button").addEventListener("click", () => {
  const raw = localStorage.getItem("local-scratch-project");
  if (raw) loadProject(JSON.parse(raw));
  status.textContent = raw ? "Loaded locally" : "No saved project";
});
renderPalette();
