import { kutnoStore } from "./kutno-store.js";

const previousPreferencePenalty = window.kutnoPreferencePenalty;

window.kutnoPreferencePenalty = (recipe) => {
  const preference = Number(previousPreferencePenalty?.(recipe)) || kutnoStore.preferencePenalty(recipe);
  const quantity = kutnoStore.quantityAssessment(recipe);
  return preference + quantity.low.length * 110;
};

kutnoStore.addEventListener("change", () => window.kutnoBridge?.rerankCatalog?.());
