"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const calc = require("../pace-calculator-engine.js");

test("reference marathon screenshot: 26.219 mi and three hours", () => {
  const s = calc.start("run");
  assert.equal(calc.text(s, "distance"), "26.219");
  assert.equal(calc.text(s, "time"), "3:00:00");
  assert.equal(calc.text(s, "pace"), "6:52");
  assert.equal(calc.text(s, "speed"), "8.74");
});

test("all five independent pairs yield identical distance/time/rate", () => {
  const cases = [
    ["distance", "10", "time", "50:00"],
    ["distance", "10", "pace", "5:00"],
    ["distance", "10", "speed", "12"],
    ["time", "50:00", "pace", "5:00"],
    ["time", "50:00", "speed", "12"]
  ];
  for (const [a, av, b, bv] of cases) {
    const s = calc.start("bike", false);
    calc.edit(s, a, av); calc.edit(s, b, bv);
    assert.equal(calc.solve(s).complete, true, a + " + " + b);
    assert.ok(Math.abs(calc.solve(s).distanceMeters - 10000) < 0.001);
    assert.ok(Math.abs(calc.solve(s).timeSeconds - 3000) < 0.001);
    assert.ok(Math.abs(calc.solve(s).metersPerSecond - 10000 / 3000) < 0.00001);
  }
});

test("pace and speed alone cannot determine total distance or time", () => {
  const s = calc.start("run", false);
  calc.edit(s, "pace", "8:00"); calc.edit(s, "speed", "7.5");
  assert.equal(calc.solve(s).distanceMeters, null);
  assert.equal(calc.solve(s).timeSeconds, null);
  assert.equal(calc.solve(s).complete, false);
  assert.match(calc.guidance(s), /same rate/);
});

test("unit switching is reversible without changing canonical values", () => {
  const s = calc.start("run");
  const distance = calc.solve(s).distanceMeters;
  calc.changeUnit(s, "km");
  assert.equal(calc.text(s, "distance"), "42.195");
  assert.equal(calc.text(s, "time"), "3:00:00");
  assert.equal(calc.solve(s).distanceMeters, distance);
  calc.changeUnit(s, "mi");
  assert.equal(calc.text(s, "distance"), "26.219");
  assert.equal(calc.solve(s).distanceMeters, distance);
});

test("editing calculated pace preserves distance and replaces time", () => {
  const s = calc.start("run");
  calc.edit(s, "pace", "7:00");
  assert.equal(calc.text(s, "distance"), "26.219");
  assert.equal(calc.text(s, "speed"), "8.57");
  assert.ok(Math.abs(calc.solve(s).timeSeconds - 26.219 * 420) < 0.00001);
});

test("clearing an entered field does not regenerate it from derived values", () => {
  const s = calc.start("run");
  calc.edit(s, "distance", "");
  assert.equal(calc.text(s, "distance"), "");
  assert.equal(calc.text(s, "pace"), "");
  assert.equal(calc.text(s, "time"), "3:00:00");
  calc.clear(s);
  assert.equal(calc.text(s, "time"), "");
});

test("swim per 100yd to per 100m and distance/speed conversion", () => {
  const s = calc.start("swim", false);
  calc.changeUnit(s, "yd");
  calc.edit(s, "distance", "100"); calc.edit(s, "pace", "1:30");
  assert.equal(calc.text(s, "time"), "1:30");
  assert.equal(calc.text(s, "speed"), "1.11");
  const d = calc.solve(s).distanceMeters;
  calc.changeUnit(s, "m");
  assert.equal(calc.text(s, "pace"), "1:38");
  assert.equal(calc.solve(s).distanceMeters, d);
});

test("invalid values are not treated as valid measurements", () => {
  const s = calc.start("run", false);
  calc.edit(s, "distance", "5");
  calc.edit(s, "pace", "1:60");
  assert.equal(calc.text(s, "pace"), "1:60");
  assert.equal(calc.solve(s).timeSeconds, null);
  assert.equal(calc.solve(s).complete, false);
});
