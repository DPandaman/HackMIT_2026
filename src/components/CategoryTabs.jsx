import { categoryLabels } from "../data/blocks";

export function CategoryTabs({ category, onChange }) {
  return (
    <div className="category-tabs" role="tablist" aria-label="Block categories">
      {Object.entries(categoryLabels).map(([key, label]) => (
        <button
          key={key}
          className={`category${category === key ? " active" : ""}`}
          data-category={key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
