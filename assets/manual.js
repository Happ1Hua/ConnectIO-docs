"use strict";

const outline = document.querySelector(".outline");
const headings = document.querySelectorAll("main h2[id]");
if (headings.length > 1) {
  const list = outline.querySelector("ul");
  for (const heading of headings) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#" + encodeURIComponent(heading.id);
    link.textContent = heading.textContent;
    item.append(link);
    list.append(item);
  }
  outline.hidden = false;
  outline.querySelector("details").open = window.matchMedia("(min-width: 70rem)").matches;
}

const search = document.querySelector(".manual-search");
const input = search.querySelector("input");
const matches = document.getElementById("matches");
const zh = document.documentElement.lang === "zh";
let indexRequest;

function loadIndex() {
  if (!indexRequest) {
    indexRequest = fetch(search.dataset.index).then(response => {
      if (!response.ok) throw new Error("Search index unavailable");
      return response.json();
    }).catch(error => {
      indexRequest = undefined;
      throw error;
    });
  }
  return indexRequest;
}

async function showMatches() {
  const query = input.value.trim().toLowerCase();
  matches.hidden = true;
  if (!query) return;
  let chapters;
  try {
    chapters = await loadIndex();
  } catch {
    if (document.activeElement === input && input.value.trim().toLowerCase() === query) {
      matches.textContent = zh ? "索引加载失败，请重新搜索。" : "Index unavailable. Try searching again.";
      matches.hidden = false;
    }
    return;
  }
  if (document.activeElement !== input || input.value.trim().toLowerCase() !== query) return;
  const terms = query.split(/\s+/);
  const found = chapters.filter(chapter => {
    const text = (chapter.title + " " + chapter.body).toLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => Number(b.title.toLowerCase().includes(query)) - Number(a.title.toLowerCase().includes(query)));
  matches.replaceChildren();
  for (const chapter of found) {
    const link = document.createElement("a");
    link.href = chapter.url;
    link.textContent = chapter.title;
    matches.append(link);
  }
  if (!found.length) matches.textContent = zh ? "没有找到匹配的章节。" : "No matching chapters.";
  matches.hidden = false;
}

search.hidden = false;
input.addEventListener("input", showMatches);
input.addEventListener("focus", showMatches);
search.addEventListener("focusout", event => {
  if (!search.contains(event.relatedTarget)) matches.hidden = true;
});
search.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    input.focus();
    input.value = "";
    matches.hidden = true;
  }
});
