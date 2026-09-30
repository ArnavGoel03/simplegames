// CSS pixels. One pixel permits browser rounding, not a second control size.
export const geometryTolerance = 1;
export function geometryFailures(groups, expectedHeight) {
  return groups.flatMap(group => {
    const buttons = group.controls.filter(control => control.kind !== "input");
    const reference = buttons[0];
    return group.controls.flatMap(control => {
      const issues = [];
      if (control.minimum ? control.height < expectedHeight - geometryTolerance : Math.abs(control.height - expectedHeight) > geometryTolerance) issues.push("height");
      if (control.clipped || control.width <= 0) issues.push("bounds");
      if (reference && group.compareType !== false && control.kind !== "input") {
        for (const key of ["height", "radius", "fontSize", "lineHeight"]) {
          if (Math.abs(control[key] - reference[key]) > geometryTolerance) issues.push(key);
        }
        if (control.fontFamily !== reference.fontFamily || control.fontWeight !== reference.fontWeight) issues.push("font");
      }
      return issues.length ? [{ group: group.name, text: control.text, issues }] : [];
    });
  });
}

export function measureControlGeometry() {
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden"; };
  const measure = element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    return { kind: element.tagName === "INPUT" ? "input" : "button", text: element.textContent?.trim() || element.getAttribute("aria-label"), height: box.height, width: box.width,
      radius: parseFloat(style.borderTopLeftRadius), fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), fontFamily: style.fontFamily, fontWeight: style.fontWeight,
      clipped: box.left < -1 || box.right > innerWidth + 1 };
  };
  const groups = [];
  for (const selector of [".play-room-actions", ".play-room-join", ".play-door-split", ".play-entry-choices", ".casino-feature-picker", ".casino-floor-filters"]) {
    for (const element of document.querySelectorAll(selector)) {
      const controls = [...element.querySelectorAll("button,a.play-btn,input.play-input")].filter(visible).map(measure);
      if (controls.length) groups.push({ name: selector, compareType: [".play-room-actions", ".play-room-join", ".play-door-split"].includes(selector), controls: controls.map(control => ({ ...control, minimum: selector === ".play-entry-choices" })) });
    }
  }
  for (const selector of ["header a.play-btn", ".play-entry-panel:not([hidden]) .play-btn", ".play-room-entry .play-btn", ".casino-enter", ".button.button--large", "[data-read-aloud-control] button"]) {
    const controls = [...document.querySelectorAll(selector)].filter(visible).map(measure);
    // Main actions may differ semantically; compare each to the height token.
    controls.forEach(control => groups.push({ name: selector, controls: [control] }));
  }
  const token = getComputedStyle(document.documentElement).getPropertyValue("--play-control-height").trim();
  const probe = document.createElement("div"); probe.style.height = token || "3rem"; document.body.append(probe);
  const expectedHeight = probe.getBoundingClientRect().height; probe.remove();
  return { groups, expectedHeight };
}
