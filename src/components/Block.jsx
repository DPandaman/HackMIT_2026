import React from "react";
import { findDefinition } from "../data/blocks";
import { blockFromDrop } from "../utils/blockHelpers";

export function Block({
  block,
  paletteBlock = false,
  active = false,
  onAdd,
  onRemove,
  onInputChange,
  onConditionDrop,
  onConditionInputChange,
  conditionOwnerId = block?.id,
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
          if (item?.category === "condition") {
            onConditionDrop(conditionOwnerId, item.type, block.id === conditionOwnerId ? null : block.id);
          }
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
            onConditionDrop={onConditionDrop}
            onConditionInputChange={onConditionInputChange}
            conditionOwnerId={block.id}
          />
        ) : (
          <span style={{ color: "white", fontSize: ".8rem", opacity: 0.78 }}>drop condition</span>
        )}
      </span>
    );
  }

  function handleBodyDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const item = blockFromDrop(event);
    if (!item) return;

    if (item.category === "condition" && ["if", "waitUntil"].includes(block.type)) {
      onConditionDrop(block.id, item.type);
      return;
    }

    onAdd(item.type, item.category, block.id);
  }

  function handleBlockDrop(event) {
    if (paletteBlock || !["if", "waitUntil"].includes(block.type)) return;

    const item = blockFromDrop(event);
    if (item?.category !== "condition") return;

    event.preventDefault();
    event.stopPropagation();
    onConditionDrop(block.id, item.type);
  }

  const canWrapChildren = !paletteBlock && ["repeat", "if", "waitUntil", "whenHear"].includes(block.type);

  return (
    <div
      className={`block ${block.category}`}
      style={blockStyle}
      draggable
      onClick={paletteBlock ? () => onAdd(block.type, block.category) : undefined}
      onDoubleClick={!paletteBlock && onRemove ? () => onRemove(block.id) : undefined}
      onDragStart={handleDragStart}
      onDragOver={(event) => {
        if (!paletteBlock && ["if", "waitUntil"].includes(block.type)) event.preventDefault();
      }}
      onDrop={handleBlockDrop}
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
            style={part.type === 'text' ? { width: '100px', textAlign: 'left' } : {}}
          />
        );
      })}

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
