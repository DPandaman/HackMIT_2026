import React from "react";
import { findDefinition } from "../data/blocks";
import { blockFromDrop, isAIValue } from "../utils/blockHelpers";

export function Block({
  block,
  paletteBlock = false,
  active = false,
  onAdd,
  onRemove,
  onInputChange,
  onConditionDrop,
  onConditionInputChange,
  onValueDrop,
  onAIPromptChange,
  onClearAIValue,
  onConditionValueDrop,
  onConditionAIPromptChange,
  onConditionClearAIValue,
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

  // Grows a textarea to fit its content instead of scrolling internally --
  // used for every AI prompt box so long prompts wrap and push the box
  // taller rather than overflowing or scrolling out of view. Works as a
  // plain ref callback (no hooks needed) since it just measures and sets
  // the DOM node's own height; React re-invokes it on every render.
  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // A textarea with no explicit width falls back to the browser's default
  // `cols`-based sizing, which doesn't track content -- so the box was
  // rendering at one fixed width regardless of what was typed. This grows
  // the box up to a cap, then leaves wrapping (from the CSS) to take over
  // for anything longer, rather than growing sideways forever.
  function textareaWidthStyle(value, maxCh = 30) {
    const length = String(value ?? "").length;
    return { width: `${Math.min(maxCh, Math.max(8, length + 2))}ch` };
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
            onInputChange={(conditionId, conditionInputIndex, value) =>
              onConditionInputChange(block.id, conditionId, conditionInputIndex, value)
            }
            onValueDrop={(conditionId, conditionInputIndex, kind) =>
              onConditionValueDrop(block.id, conditionId, conditionInputIndex, kind)
            }
            onAIPromptChange={(conditionId, conditionInputIndex, prompt) =>
              onConditionAIPromptChange(block.id, conditionId, conditionInputIndex, prompt)
            }
            onClearAIValue={(conditionId, conditionInputIndex, defaultValue) =>
              onConditionClearAIValue(block.id, conditionId, conditionInputIndex, defaultValue)
            }
          />
        ) : (
          <span style={{ color: "white", fontSize: ".8rem", opacity: 0.78 }}>drop condition</span>
        )}
      </span>
    );
  }

  // Renders an input slot that has had the AI block dropped into it -- e.g.
  // "move [AI: how far should the cat go?] steps". `part` is the slot's own
  // template definition (so we know whether it wants a number or text back).
  function renderAIValueSocket(aiValue, index, part) {
    if (paletteBlock) {
      return (
        <span key={index} style={{ opacity: 0.78 }}>
          &lt;AI&gt;
        </span>
      );
    }

    return (
      <span
        key={index}
        className="ai-value-slot"
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
          if (item?.category === "ai") onValueDrop(block.id, index, part.type);
        }}
      >
        <span className="ai-value-badge">AI</span>
        <textarea
          rows={1}
          className="ai-value-prompt"
          value={aiValue.prompt}
          style={textareaWidthStyle(aiValue.prompt, 24)}
          ref={autoResizeTextarea}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onAIPromptChange(block.id, index, event.target.value)}
          onInput={(event) => autoResizeTextarea(event.target)}
        />
        {aiValue.lastAnswer != null && (
          <span className="ai-value-answer" title="What the AI chose last run">
            &rarr; {aiValue.lastAnswer}
          </span>
        )}
        <button
          type="button"
          className="ai-value-clear"
          title="Use a typed value instead"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClearAIValue(block.id, index, part.value);
          }}
        >
          ×
        </button>
      </span>
    );
  }

  function handleBodyDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const item = blockFromDrop(event);
    if (item && item.category !== "ai") onAdd(item.type, item.category, block.id);
  }

  const canWrapChildren = !paletteBlock && ["repeat", "if", "whenHear"].includes(block.type);

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
        const currentValue = block.inputs[currentIndex] ?? part.value;

        if (isAIValue(currentValue)) {
          return renderAIValueSocket(currentValue, currentIndex, part);
        }

        if (part.type === "text") {
          return (
            <textarea
              key={index}
              rows={1}
              className="block-textarea"
              value={currentValue}
              readOnly={paletteBlock}
              style={textareaWidthStyle(currentValue, 30)}
              ref={autoResizeTextarea}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onInputChange(block.id, currentIndex, event.target.value)}
              onInput={(event) => autoResizeTextarea(event.target)}
              onDragOver={
                !paletteBlock
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  : undefined
              }
              onDrop={
                !paletteBlock
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const item = blockFromDrop(event);
                      if (item?.category === "ai") onValueDrop(block.id, currentIndex, part.type);
                    }
                  : undefined
              }
            />
          );
        }

        return (
          <input
            key={index}
            type={part.type}
            min={part.min}
            step={part.step}
            value={currentValue}
            readOnly={paletteBlock}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onInputChange(block.id, currentIndex, event.target.value)}
            onDragOver={
              !paletteBlock
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                : undefined
            }
            onDrop={
              !paletteBlock
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const item = blockFromDrop(event);
                    if (item?.category === "ai") onValueDrop(block.id, currentIndex, part.type);
                  }
                : undefined
            }
          />
        );
      })}

      {/* Shows what an "AI:" condition decided last run, e.g. "AI: ... -> true" */}
      {!paletteBlock && block.lastAnswer != null && (
        <span className="ai-value-answer" title="What the AI decided last run">
          &rarr; {block.lastAnswer}
        </span>
      )}

      {canWrapChildren && (
        <div
          className="block-children"
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDrop={handleBodyDrop}
        >
          {Array.isArray(block.children) && block.children.length > 0 ? (
            block.children.map((child) => (
              <Block
                key={child.id}
                block={child}
                active={active}
                onAdd={onAdd}
                onRemove={onRemove}
                onInputChange={onInputChange}
                onConditionDrop={onConditionDrop}
                onConditionInputChange={onConditionInputChange}
                onValueDrop={onValueDrop}
                onAIPromptChange={onAIPromptChange}
                onClearAIValue={onClearAIValue}
                onConditionValueDrop={onConditionValueDrop}
                onConditionAIPromptChange={onConditionAIPromptChange}
                onConditionClearAIValue={onConditionClearAIValue}
              />
            ))
          ) : (
            <span className="block-drop-hint">drop block here</span>
          )}
        </div>
      )}

      {!paletteBlock && onRemove && (
        <button
          className="delete-block"
          type="button"
          title="Delete block"
          aria-label={`Delete ${block.type} block`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(block.id);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
