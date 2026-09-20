import { Block } from "./Block";

export function ScriptWorkspace({
  activeBlockId,
  blocks,
  dragOver,
  onAdd,
  onBlockInputChange,
  onConditionDrop,
  onConditionInputChange,
  onDeleteBlock,
  onDragLeave,
  onDragOver,
  onDrop,
  onValueDrop,
  onAIPromptChange,
  onClearAIValue,
}) {
  return (
    <div
      className={`script${dragOver ? " drag-over" : ""}`}
      aria-label="Script workspace"
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {blocks.length === 0 ? (
        <div className="drop-message">Drop blocks here to build your program</div>
      ) : (
        blocks.map((block) => (
          <Block
            key={block.id}
            block={block}
            active={activeBlockId === block.id}
            onAdd={onAdd}
            onRemove={onDeleteBlock}
            onInputChange={onBlockInputChange}
            onConditionDrop={onConditionDrop}
            onConditionInputChange={onConditionInputChange}
            onValueDrop={onValueDrop}
            onAIPromptChange={onAIPromptChange}
            onClearAIValue={onClearAIValue}
          />
        ))
      )}
    </div>
  );
}
