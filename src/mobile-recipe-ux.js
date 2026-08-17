(() => {
  "use strict";

  const CYRILLIC = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };

  function recipeSlug(value = "") {
    return String(value)
      .toLocaleLowerCase("ru-RU")
      .split("")
      .map((character) => CYRILLIC[character] ?? character)
      .join("")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "recipe";
  }

  function titleForOpener(opener) {
    const stored = String(opener?.dataset?.recipeTitle || "").trim();
    if (stored) return stored;
    const card = opener?.closest?.("article");
    const headingOpener = card?.querySelector("h2 [data-open-recipe], h3 [data-open-recipe]");
    const headingTitle = String(headingOpener?.textContent || card?.querySelector("h2, h3")?.textContent || "").trim();
    if (headingTitle) return headingTitle;
    const own = String(opener?.textContent || "").trim();
    if (own && !/^открыть рецепт/i.test(own)) return own;
    return "";
  }

  function recipeHref(title) {
    return title ? `/recipe/${recipeSlug(title)}` : "/recipes";
  }

  function copyButtonToAnchor(button) {
    if (!(button instanceof HTMLButtonElement) || !button.matches("[data-open-recipe]")) return null;
    const title = titleForOpener(button);
    const anchor = document.createElement("a");
    for (const attribute of button.attributes) {
      if (attribute.name === "type" || attribute.name === "disabled") continue;
      anchor.setAttribute(attribute.name, attribute.value);
    }
    anchor.setAttribute("href", recipeHref(title));
    anchor.setAttribute("role", "button");
    if (title) anchor.dataset.recipeTitle = title;
    while (button.firstChild) anchor.append(button.firstChild);
    button.replaceWith(anchor);
    return anchor;
  }

  function normalizeRecipeAnchors(root = document) {
    const buttons = [];
    if (root instanceof Element && root.matches("button[data-open-recipe]")) buttons.push(root);
    if (root.querySelectorAll) buttons.push(...root.querySelectorAll("button[data-open-recipe]"));
    buttons.forEach(copyButtonToAnchor);

    const anchors = [];
    if (root instanceof Element && root.matches("a[data-open-recipe]")) anchors.push(root);
    if (root.querySelectorAll) anchors.push(...root.querySelectorAll("a[data-open-recipe]"));
    anchors.forEach((anchor) => {
      const title = titleForOpener(anchor);
      if (title) {
        anchor.dataset.recipeTitle = title;
        anchor.setAttribute("href", recipeHref(title));
      }
      if (!anchor.hasAttribute("role")) anchor.setAttribute("role", "button");
    });
  }

  function linkRecipePhotos(root = document) {
    const figures = [];
    if (root instanceof Element && root.matches(".kutno-recipe-photo--card")) figures.push(root);
    if (root.querySelectorAll) figures.push(...root.querySelectorAll(".kutno-recipe-photo--card"));
    figures.forEach((figure) => {
      if (figure.closest("a.kutno-recipe-photo-link")) return;
      const card = figure.closest("article");
      const opener = card?.querySelector("a[data-open-recipe][href]");
      if (!opener) return;
      const title = titleForOpener(opener);
      if (!title) return;
      const link = document.createElement("a");
      link.className = "kutno-recipe-photo-link";
      link.setAttribute("href", opener.getAttribute("href") || recipeHref(title));
      link.dataset.recipeTitle = title;
      if (opener.dataset.openRecipe !== undefined) link.dataset.openRecipe = opener.dataset.openRecipe;
      if (opener.dataset.recipeSource) link.dataset.recipeSource = opener.dataset.recipeSource;
      link.setAttribute("aria-label", `Открыть рецепт «${title}»`);
      figure.replaceWith(link);
      link.append(figure);
    });
  }

  function normalizeShareArrow(root = document) {
    const buttons = [];
    if (root instanceof Element && root.matches(".kf-share")) buttons.push(root);
    if (root.querySelectorAll) buttons.push(...root.querySelectorAll(".kf-share"));
    buttons.forEach((button) => {
      if (button.dataset.kutnoTextArrow === "true") return;
      const arrow = document.createElement("span");
      arrow.className = "kf-share-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗︎";
      button.replaceChildren(document.createTextNode("Поделиться "), arrow);
      button.dataset.kutnoTextArrow = "true";
    });
  }

  function markMobileShowMore(root = document) {
    const buttons = [];
    if (root instanceof Element && root.matches("[data-catalog-show-more]")) buttons.push(root);
    if (root.querySelectorAll) buttons.push(...root.querySelectorAll("[data-catalog-show-more]"));
    buttons.forEach((button) => {
      button.classList.add("kutno-mobile-show-more");
      if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", "Показать ещё рецепты");
    });
  }

  function enhance(root = document) {
    normalizeRecipeAnchors(root);
    linkRecipePhotos(root);
    normalizeShareArrow(root);
    markMobileShowMore(root);
  }

  function isPlainActivation(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[data-recipe-title][href^='/recipe/']");
    if (!link || !isPlainActivation(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const title = String(link.dataset.recipeTitle || "").trim();
    if (!title) {
      location.assign(link.href);
      return;
    }
    link.setAttribute("aria-busy", "true");
    Promise.resolve(window.kutnoBridge?.openRecipe?.({ title, animate: true })).then((opened) => {
      if (!opened) {
        location.assign(link.href);
        return;
      }
      requestAnimationFrame(() => document.querySelector(".recipe-sheet [data-action='close-recipe']")?.focus({ preventScroll: true }));
    }).catch(() => location.assign(link.href)).finally(() => link.removeAttribute("aria-busy"));
  }, true);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) enhance(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("kutno:ready", () => enhance(document));
  window.addEventListener("kutno:bridge-ready", () => enhance(document));
  enhance(document);
})();
