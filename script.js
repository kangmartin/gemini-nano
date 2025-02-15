/**
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { marked } from "https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

(async () => {
  const errorMessage = document.getElementById("error-message");
  const costSpan = document.getElementById("cost");
  const promptArea = document.getElementById("prompt-area");
  const problematicArea = document.getElementById("problematic-area");
  const promptInput = document.getElementById("prompt-input");
  const responseArea = document.getElementById("response-area");
  const resetButton = document.getElementById("reset-button");
  const copyHelper = document.querySelector("small");
  const form = document.querySelector("form");

  responseArea.style.display = "none";

  let session = null;

  if (!self.ai || !self.ai.languageModel) {
    errorMessage.style.display = "block";
    errorMessage.innerHTML = `Your browser doesn't support the Prompt API. If you're on Chrome, join the <a href="https://developer.chrome.com/docs/ai/built-in#get_an_early_preview">Early Preview Program</a> to enable it.`;
    return;
  }

  promptArea.style.display = "block";
  copyHelper.style.display = "none";

  const promptModel = async (highlight = false) => {
    copyHelper.style.display = "none";
    problematicArea.style.display = "none";
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    responseArea.style.display = "block";
    const heading = document.createElement("h3");
    heading.classList.add("prompt", "speech-bubble");
    heading.textContent = prompt;
    responseArea.append(heading);
    const p = document.createElement("p");
    p.classList.add("response", "speech-bubble");
    p.textContent = "Generating response...";
    responseArea.append(p);
    let fullResponse = "";

    try {
      if (!session) {
        await updateSession();
        updateStats();
      }
      const stream = await session.promptStreaming(prompt);

      let result = '';
      let previousChunk = '';
      for await (const chunk of stream) {
        const newChunk = chunk.startsWith(previousChunk)
            ? chunk.slice(previousChunk.length) : chunk;
        result += newChunk;
        p.innerHTML = DOMPurify.sanitize(marked.parse(result));
        previousChunk = chunk;
      }
    } catch (error) {
      p.textContent = `Error: ${error.message}`;
    } finally {
      if (highlight) {
        problematicArea.style.display = "block";
        problematicArea.querySelector("#problem").innerText =
          decodeURIComponent(highlight).trim();
      }
      updateStats();
    }
  };

  const updateStats = () => {};

  const params = new URLSearchParams(location.search);
  const urlPrompt = params.get("prompt");
  const highlight = params.get("highlight");
  if (urlPrompt) {
    promptInput.value = decodeURIComponent(urlPrompt).trim();
    await promptModel(highlight);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await promptModel();
  });

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit"));
    }
  });

  promptInput.addEventListener("focus", () => {
    promptInput.select();
  });

  promptInput.addEventListener("input", async () => {
    const value = promptInput.value.trim();
    if (!value) {
      return;
    }
    const cost = await session.countPromptTokens(value);
    if (!cost) {
      return;
    }
    costSpan.textContent = `${cost} token${cost === 1 ? '' : 's'}`;
  });

  const resetUI = () => {
    responseArea.style.display = "none";
    responseArea.innerHTML = "";
    problematicArea.style.display = "none";
    copyHelper.style.display = "none";
    promptInput.focus();
  };

  resetButton.addEventListener("click", () => {
    promptInput.value = "";
    resetUI();
    session.destroy();
    session = null;
    updateSession();
  });

  const updateSession = async () => {
    session = await self.ai.languageModel.create({
      temperature: 0.800000011920929,
      topK: 128,
    });
    resetUI();
    updateStats();
  };

  if (!session) {
    await updateSession();
  }
})();