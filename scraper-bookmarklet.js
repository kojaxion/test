(function () {
  // Remove any existing panel from a previous run.
  const existing = document.getElementById("__scraper-panel__");
  if (existing) { existing.remove(); return; }

  // ── Collect images ────────────────────────────────────────────────────────
  const images = Array.from(document.querySelectorAll("img"))
    .map((img) => {
      try { return new URL(img.src, location.href).href; }
      catch { return img.src; }
    })
    .filter((src) => src && !src.startsWith("data:"))
    .filter((src, i, arr) => arr.indexOf(src) === i);

  // ── Collect text ──────────────────────────────────────────────────────────
  const textNodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p"))
    .filter((el) => {
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
    })
    .map((el) => ({ tag: el.tagName.toLowerCase(), text: el.innerText.trim() }))
    .filter((item) => item.text.length > 0);

  // ── Build overlay ─────────────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.id = "__scraper-panel__";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "2147483647",
    background: "rgba(0,0,0,0.6)", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    boxSizing: "border-box", padding: "16px",
  });

  // Close on backdrop click.
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  Object.assign(panel.style, {
    background: "#fff", borderRadius: "12px", width: "100%",
    maxWidth: "680px", maxHeight: "90vh", display: "flex",
    flexDirection: "column", overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  });

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: "1px solid #e5e7eb",
    flexShrink: "0",
  });

  const title = document.createElement("span");
  title.textContent = `Scraped — ${images.length} image${images.length !== 1 ? "s" : ""}, ${textNodes.length} text block${textNodes.length !== 1 ? "s" : ""}`;
  Object.assign(title.style, { fontWeight: "600", fontSize: "15px", color: "#111" });

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "8px", alignItems: "center" });

  // Copy JSON button.
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy JSON";
  Object.assign(copyBtn.style, {
    padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db",
    background: "#f9fafb", cursor: "pointer", fontSize: "13px",
    color: "#374151", fontWeight: "500",
  });
  copyBtn.addEventListener("click", () => {
    const payload = JSON.stringify({ url: location.href, title: document.title, collectedAt: new Date().toISOString(), images, text: textNodes }, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = payload;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 2000);
    }
  });

  // Close button.
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  Object.assign(closeBtn.style, {
    padding: "4px 10px", borderRadius: "6px", border: "none",
    background: "transparent", cursor: "pointer", fontSize: "18px",
    color: "#6b7280", lineHeight: "1",
  });
  closeBtn.addEventListener("click", () => overlay.remove());

  btnRow.append(copyBtn, closeBtn);
  header.append(title, btnRow);

  // ── Scrollable body ───────────────────────────────────────────────────────
  const body = document.createElement("div");
  Object.assign(body.style, {
    overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px",
    display: "flex", flexDirection: "column", gap: "20px",
  });

  // ── Images section ────────────────────────────────────────────────────────
  if (images.length > 0) {
    const imgSection = document.createElement("div");

    const imgHeading = document.createElement("p");
    imgHeading.textContent = `Images (${images.length})`;
    Object.assign(imgHeading.style, {
      margin: "0 0 10px", fontWeight: "600", fontSize: "13px",
      textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280",
    });

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
      gap: "8px",
    });

    images.forEach((src) => {
      const link = document.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      Object.assign(link.style, { display: "block", borderRadius: "6px", overflow: "hidden", background: "#f3f4f6" });

      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      Object.assign(img.style, {
        width: "100%", height: "90px", objectFit: "cover",
        display: "block", transition: "opacity 0.2s",
      });
      // Hide broken images.
      img.onerror = () => { link.style.display = "none"; };

      link.appendChild(img);
      grid.appendChild(link);
    });

    imgSection.append(imgHeading, grid);
    body.appendChild(imgSection);
  }

  // ── Text section ──────────────────────────────────────────────────────────
  if (textNodes.length > 0) {
    const txtSection = document.createElement("div");

    const txtHeading = document.createElement("p");
    txtHeading.textContent = `Text (${textNodes.length} blocks)`;
    Object.assign(txtHeading.style, {
      margin: "0 0 10px", fontWeight: "600", fontSize: "13px",
      textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280",
    });

    const list = document.createElement("div");
    Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "8px" });

    textNodes.forEach(({ tag, text }) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex", gap: "10px", alignItems: "baseline",
        padding: "8px 10px", borderRadius: "6px", background: "#f9fafb",
        border: "1px solid #e5e7eb",
      });

      const badge = document.createElement("span");
      badge.textContent = tag;
      Object.assign(badge.style, {
        fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
        letterSpacing: "0.08em", color: "#fff", background: tag.startsWith("h") ? "#6366f1" : "#9ca3af",
        borderRadius: "4px", padding: "2px 5px", flexShrink: "0",
      });

      const content = document.createElement("span");
      content.textContent = text;
      Object.assign(content.style, {
        fontSize: "13px", lineHeight: "1.5", color: "#111827",
        wordBreak: "break-word",
        // Clamp long paragraphs — user can scroll within the panel.
        display: "-webkit-box", WebkitLineClamp: "4",
        WebkitBoxOrient: "vertical", overflow: "hidden",
      });

      row.append(badge, content);
      list.appendChild(row);
    });

    txtSection.append(txtHeading, list);
    body.appendChild(txtSection);
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (images.length === 0 && textNodes.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Nothing found on this page.";
    Object.assign(empty.style, { color: "#6b7280", textAlign: "center", margin: "24px 0" });
    body.appendChild(empty);
  }

  panel.append(header, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
})();
