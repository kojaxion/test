// ── Scraper Bookmarklet ──────────────────────────────────────────────────────
// Collects images and text from the current page, copies JSON to clipboard.
//
// HOW TO INSTALL:
//   1. Create a new bookmark in your browser.
//   2. Set the Name to anything (e.g. "Scrape Page").
//   3. Set the URL to the entire contents of `bookmarklet.min.js` (the line
//      starting with "javascript:").
//
// HOW TO USE:
//   Navigate to any page, click the bookmark, then paste wherever you need it.
// ────────────────────────────────────────────────────────────────────────────

(function () {
  // ── Images ────────────────────────────────────────────────────────────────
  const images = Array.from(document.querySelectorAll("img"))
    .map((img) => {
      // Resolve relative URLs against the page origin.
      try {
        return new URL(img.src, location.href).href;
      } catch {
        return img.src;
      }
    })
    .filter(
      (src) =>
        src &&
        // Skip data URIs (inline SVG placeholders, tracking pixels, etc.)
        !src.startsWith("data:") &&
        // Skip 1×1 tracking pixels by checking the natural dimensions when available.
        true
    )
    // Deduplicate.
    .filter((src, i, arr) => arr.indexOf(src) === i);

  // ── Text ──────────────────────────────────────────────────────────────────
  const textNodes = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6, p")
  )
    .filter((el) => {
      // Skip hidden elements.
      const style = getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    })
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: el.innerText.trim(),
    }))
    .filter((item) => item.text.length > 0);

  // ── Bundle & copy ─────────────────────────────────────────────────────────
  const payload = JSON.stringify(
    {
      url: location.href,
      title: document.title,
      collectedAt: new Date().toISOString(),
      images,
      text: textNodes,
    },
    null,
    2
  );

  // Modern Clipboard API with execCommand fallback for older browsers.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).then(
      () => alert(`Copied!\n\n${images.length} image(s), ${textNodes.length} text block(s).`),
      () => fallbackCopy(payload)
    );
  } else {
    fallbackCopy(payload);
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) {
      alert(`Copied!\n\n${images.length} image(s), ${textNodes.length} text block(s).`);
    } else {
      alert("Copy failed — check the console for the raw JSON.");
      console.log(text);
    }
  }
})();
