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
    swim: { units: ["yd", "m"], defaultUnit: "yd", distance: "500", time: "8:20" },
    bike: { units: ["mi", "km"], defaultUnit: "mi", distance: "25", time: "1:15:00" },
    run:  { units: ["mi", "km"], defaultUnit: "mi", distance: "26.219", time: "3:00:00" }
  };

  // Canonical race distances are meters. Displayed distances follow the
  // athlete's currently selected unit, without changing the actual course.
  // Keep the catalog sport-specific: no marathon option for Swim or Bike.
  const racePresets = {
    swim: [
      { id: "pool100", title: "Pool swim · 100 yd", meters: 100 * units.yd },
      { id: "pool500", title: "Pool swim · 500 yd", meters: 500 * units.yd },
      { id: "sprint", title: "Sprint triathlon swim", meters: 750 },
      { id: "olympic", title: "Olympic triathlon swim", meters: 1500 },
      { id: "half", title: "70.3 triathlon swim", meters: 1.2 * units.mi },
      { id: "full", title: "Full-distance triathlon swim", meters: 2.4 * units.mi }
    ],
    bike: [
      { id: "tt10", title: "10-mile time trial", meters: 10 * units.mi },
      { id: "sprint", title: "Sprint triathlon bike", meters: 20000 },
      { id: "olympic", title: "Olympic triathlon bike", meters: 40000 },
      { id: "half", title: "70.3 triathlon bike", meters: 56 * units.mi },
      { id: "full", title: "Full-distance triathlon bike", meters: 112 * units.mi },
      { id: "century", title: "Century ride", meters: 100 * units.mi }
    ],
    run: [
      { id: "mile", title: "1-mile run", meters: units.mi },
      { id: "5k", title: "5K", meters: 5000 },
      { id: "10k", title: "10K", meters: 10000 },
      { id: "half", title: "Half marathon", meters: 21097.5 },
      { id: "marathon", title: "Marathon", meters: 42195 }
    ]
  };

  const projectionDefaults = {
    swim: { pace: "1:40", raceID: "olympic" },
    bike: { speed: "20", raceID: "olympic" },
    run:  { pace: "6:52", raceID: "half" }
  };
  const fields = ["distance", "time", "pace", "speed"];
  const visibleFields = sport => sport === "bike"
    ? ["distance", "time", "speed"] : fields;

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
    const trimmed = String(text).trim().replace(",", ".");
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

  function paceBasisMeters(sport, unit) {
    if (!sports[sport] || !sports[sport].units.includes(unit)) return null;
    return units[unit] * (sport === "swim" ? 100 : 1);
  }

  function projectionRate(paceText, sport, unit) {
    const seconds = parseClock(paceText), distance = paceBasisMeters(sport, unit);
    return seconds !== null && distance ? seconds / distance : null;
  }

  function projectionPace(rateSecondsPerMeter, sport, unit) {
    const distance = paceBasisMeters(sport, unit);
    return rateSecondsPerMeter > 0 && Number.isFinite(rateSecondsPerMeter) && distance
      ? clock(rateSecondsPerMeter * distance) : "";
  }

  // Cycling projections use distance ÷ speed, never minutes per mile.
  function projectionSpeedRate(speedText, unit) {
    if (!sports.bike.units.includes(unit)) return null;
    const speed = number(speedText);
    return speed === null ? null : 3600 / (speed * units[unit]);
  }

  function projectionSpeed(rateSecondsPerMeter, unit) {
    if (!sports.bike.units.includes(unit) || !(rateSecondsPerMeter > 0) ||
        !Number.isFinite(rateSecondsPerMeter)) return "";
    return decimal(3600 / (rateSecondsPerMeter * units[unit]), 2);
  }

  function raceDistanceLabel(race, unit) {
    if (!race || !units[unit] || !Number.isFinite(race.meters)) return "";
    const d = race.meters / units[unit];
    const digits = unit === "m" || unit === "yd" ? 0 : 2;
    return race.title + " · " + new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits
    }).format(d) + " " + unit;
  }

  function raceProjection(sport, raceID, rateSecondsPerMeter) {
    const race = racePresets[sport]?.find(item => item.id === raceID);
    if (!race || !(rateSecondsPerMeter > 0) || !Number.isFinite(rateSecondsPerMeter)) return null;
    const seconds = race.meters * rateSecondsPerMeter;
    return Number.isFinite(seconds) && seconds > 0 && seconds <= Number.MAX_SAFE_INTEGER
      ? { seconds, clock: clock(seconds), meters: race.meters, raceID: race.id } : null;
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
    if (state.sport === "bike") return solve(state).complete
      ? "Distance, time and speed stay linked. Edit any value to recalculate."
      : "Enter two values: distance and time, distance and speed, or time and speed.";
    if (state.anchors.length === 2 && state.anchors.every(x => x === "pace" || x === "speed")) {
      return "Pace and speed describe the same rate. Enter distance or time to calculate the full workout.";
    }
    return solve(state).complete
      ? "All values are linked. Edit any field; the remaining values recalculate immediately."
      : "Enter two independent values, such as distance and time, distance and pace, or time and speed.";
  }

  return {
    start, edit, solve, text, changeUnit, clear, suffix, guidance,
    parseClock, clock, sports, fields, visibleFields, racePresets, projectionDefaults,
    paceBasisMeters, projectionRate, projectionPace, projectionSpeedRate, projectionSpeed,
    raceDistanceLabel, raceProjection
  };
});
