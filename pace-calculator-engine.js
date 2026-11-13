/*
 * EnduroPace linked calculator — browser-only, no dependencies or network access.
 * Keep mathematical behavior aligned with LinkedPaceCalculatorState.swift.
 */
(function (root, factory) {
  "use strict";
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  else root.EnduroPacePace = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const units = { mi: 1609.344, km: 1000, m: 1, yd: 0.9144 };
  const sports = {
    swim: { units: ["m", "yd"], defaultUnit: "m", distance: "1500", time: "30:00" },
    bike: { units: ["mi", "km"], defaultUnit: "km", distance: "40", time: "1:00:00" },
    run:  { units: ["mi", "km"], defaultUnit: "mi", distance: "26.219", time: "3:00:00" }
  };
  const fields = ["distance", "time", "pace", "speed"];

  function parseClock(text) {
    const parts = String(text).trim().split(":");
    if (parts.length < 1 || parts.length > 3 || !parts.every(x => /^\d+$/.test(x))) return null;
    const numbers = parts.map(Number);
    if (numbers.length >= 2 && numbers[numbers.length - 1] >= 60) return null;
    if (numbers.length === 3 && numbers[1] >= 60) return null;
    const seconds = numbers.reduce((total, value) => total * 60 + value, 0);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  function clock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > Number.MAX_SAFE_INTEGER) return "—";
    const n = Math.round(seconds), h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60), s = n % 60;
    return h > 0
      ? h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
      : Math.floor(n / 60) + ":" + String(s).padStart(2, "0");
  }

  function number(text) {
    const trimmed = String(text).trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
    const result = Number(trimmed);
    return Number.isFinite(result) && result > 0 ? result : null;
  }

  function decimal(n, digits) {
    return Number.isFinite(n) && n > 0
      ? n.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "")
      : "";
  }

  function basis(state) {
    return units[state.unit] * (state.sport === "swim" ? 100 : 1);
  }

  function canonical(state, field, raw) {
    const value = field === "time" || field === "pace" ? parseClock(raw) : number(raw);
    if (value === null) return null;
    let result;
    switch (field) {
      case "distance": result = value * units[state.unit]; break;
      case "time": result = value; break;
      case "pace": result = basis(state) / value; break;
      case "speed": result = value * units[state.unit] / (state.sport === "swim" ? 1 : 3600); break;
      default: return null;
    }
    return Number.isFinite(result) && result > 0 ? result : null;
  }

  function start(sport, example = true) {
    if (!sports[sport]) throw new Error("Unknown sport");
    const state = { sport, unit: sports[sport].defaultUnit, inputs: {}, anchors: [] };
    if (example) {
      edit(state, "distance", sports[sport].distance);
      edit(state, "time", sports[sport].time);
    }
    return state;
  }

  function edit(state, field, raw) {
    if (!fields.includes(field)) throw new Error("Unknown field");
    if (!String(raw).trim()) {
      delete state.inputs[field];
      state.anchors = state.anchors.filter(x => x !== field);
      return;
    }
    const others = state.anchors.filter(x => x !== field);
    const priority = field === "distance" ? ["time", "pace", "speed"] :
      field === "time" ? ["distance", "pace", "speed"] : ["distance", "time"];
    let companion = priority.find(key => others.includes(key) && state.inputs[key]?.canonical != null);
    if (!companion) companion = others.slice().reverse().find(key => state.inputs[key]?.canonical != null);
    if (!companion) companion = others[others.length - 1];
    const oldCompanion = companion ? state.inputs[companion] : null;
    state.inputs = {};
    state.anchors = [];
    if (companion && oldCompanion) {
      state.inputs[companion] = oldCompanion;
      state.anchors.push(companion);
    }
    state.inputs[field] = { raw: String(raw), canonical: canonical(state, field, raw) };
    state.anchors.push(field);
  }

  function solve(state) {
    let distanceMeters = state.inputs.distance?.canonical ?? null;
    let timeSeconds = state.inputs.time?.canonical ?? null;
    const latestRate = state.anchors.slice().reverse().find(x => x === "pace" || x === "speed");
    let metersPerSecond = latestRate ? state.inputs[latestRate]?.canonical ?? null : null;
    if (distanceMeters != null && timeSeconds != null && timeSeconds > 0) {
      metersPerSecond = distanceMeters / timeSeconds;
    } else if (distanceMeters != null && metersPerSecond != null && metersPerSecond > 0) {
      timeSeconds = distanceMeters / metersPerSecond;
    } else if (timeSeconds != null && metersPerSecond != null && metersPerSecond > 0) {
      distanceMeters = timeSeconds * metersPerSecond;
    }
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) distanceMeters = null;
    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) timeSeconds = null;
    if (!Number.isFinite(metersPerSecond) || metersPerSecond <= 0) metersPerSecond = null;
    return {
      distanceMeters, timeSeconds, metersPerSecond,
      complete: distanceMeters !== null && timeSeconds !== null && metersPerSecond !== null
    };
  }

  function formatted(state, field, value) {
    if (value == null || !Number.isFinite(value) || value <= 0) return "";
    switch (field) {
      case "distance": return decimal(value / units[state.unit], state.sport === "swim" ? 2 : 3);
      case "time": return clock(value);
      case "pace": return clock(basis(state) / value);
      case "speed": return decimal(value * (state.sport === "swim" ? 1 : 3600) / units[state.unit], 2);
      default: return "";
    }
  }

  function text(state, field) {
    if (state.inputs[field]) return state.inputs[field].raw;
    const solved = solve(state);
    switch (field) {
      case "distance": return formatted(state, field, solved.distanceMeters);
      case "time": return formatted(state, field, solved.timeSeconds);
      case "pace":
      case "speed": return formatted(state, field, solved.metersPerSecond);
      default: return "";
    }
  }

  function changeUnit(state, next) {
    if (!sports[state.sport].units.includes(next) || state.unit === next) return;
    state.unit = next;
    Object.keys(state.inputs).forEach(field => {
      const input = state.inputs[field];
      if (input.canonical != null) {
        input.raw = formatted(state, field, input.canonical);
        // Preserve canonical double, rather than re-parsing rounded visible text.
      }
    });
  }

  function clear(state) {
    state.inputs = {};
    state.anchors = [];
  }

  function suffix(state, field) {
    switch (field) {
      case "distance": return state.unit;
      case "time": return "h:m:s";
      case "pace": return state.sport === "swim" ? "/100 " + state.unit : "/" + state.unit;
      case "speed": return state.unit + (state.sport === "swim" ? "/s" : "/h");
      default: return "";
    }
  }

  function guidance(state) {
    if (state.anchors.length === 2 && state.anchors.every(x => x === "pace" || x === "speed")) {
      return "Pace and speed describe the same rate. Enter distance or time to calculate the full workout.";
    }
    return solve(state).complete
      ? "All values are linked. Edit any field; the remaining values recalculate immediately."
      : "Enter two independent values, such as distance and time, distance and pace, or time and speed.";
  }

  return { start, edit, solve, text, changeUnit, clear, suffix, guidance, parseClock, clock, sports, fields };
});
