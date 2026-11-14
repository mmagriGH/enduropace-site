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
    calc.changeUnit(s, "km"); // Explicit metric fixture; website now defaults to miles.
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


test("website defaults to miles for Run and Bike and yards for Swim", () => {
  assert.equal(calc.start("run").unit, "mi");
  assert.equal(calc.start("bike").unit, "mi");
  assert.equal(calc.start("swim").unit, "yd");
  assert.equal(calc.text(calc.start("swim"), "distance"), "500");
  assert.equal(calc.text(calc.start("bike"), "distance"), "25");
});

test("each sport offers only race-appropriate distance presets", () => {
  const swimIDs = calc.racePresets.swim.map(r => r.id);
  const bikeIDs = calc.racePresets.bike.map(r => r.id);
  const runIDs = calc.racePresets.run.map(r => r.id);
  assert.ok(swimIDs.includes("olympic"));
  assert.ok(bikeIDs.includes("century"));
  assert.ok(runIDs.includes("marathon"));
  assert.ok(!swimIDs.includes("marathon"));
  assert.ok(!bikeIDs.includes("marathon"));
  for (const sport of ["swim", "bike", "run"]) {
    assert.ok(calc.racePresets[sport].every(r => Number.isFinite(r.meters) && r.meters > 0));
    assert.ok(calc.racePresets[sport].some(r => r.id === calc.projectionDefaults[sport].raceID));
  }
});

test("swim projection uses pace per 100 yards, not per yard", () => {
  const pace = calc.projectionRate("1:40", "swim", "yd");
  assert.equal(calc.raceProjection("swim", "pool500", pace).clock, "8:20");
  assert.equal(calc.raceProjection("swim", "pool100", pace).clock, "1:40");
  assert.equal(calc.projectionPace(pace, "swim", "m"), "1:49");
  assert.match(calc.raceDistanceLabel(calc.racePresets.swim[0], "yd"), /100 yd/);
  assert.match(calc.raceDistanceLabel(calc.racePresets.swim[0], "m"), /91 m/);
});

test("bike projection uses selected unit rather than hard-coded run kilometers", () => {
  const pace = calc.projectionRate("3:00", "bike", "mi");
  assert.equal(calc.raceProjection("bike", "tt10", pace).clock, "30:00");
  assert.equal(calc.projectionPace(pace, "bike", "km"), "1:52");
  assert.match(calc.raceDistanceLabel(calc.racePresets.bike.find(r => r.id === "olympic"), "mi"), /24\.85 mi/);
  assert.match(calc.raceDistanceLabel(calc.racePresets.bike.find(r => r.id === "olympic"), "km"), /40 km/);
});

test("run projection uses selected mile and kilometer pace units", () => {
  const pace = calc.projectionRate("8:00", "run", "mi");
  const marathon = calc.raceProjection("run", "marathon", pace);
  assert.ok(marathon.seconds > 3 * 3600);
  assert.equal(calc.projectionPace(pace, "run", "km"), "4:58");
  assert.match(calc.raceDistanceLabel(calc.racePresets.run.find(r => r.id === "5k"), "mi"), /3\.11 mi/);
  assert.match(calc.raceDistanceLabel(calc.racePresets.run.find(r => r.id === "5k"), "km"), /5 km/);
});

test("canonical race projection is identical across units and invalid input remains invalid", () => {
  for (const sport of ["swim", "bike", "run"]) {
    const initialUnit = calc.start(sport).unit;
    const original = calc.projectionRate(calc.projectionDefaults[sport].pace, sport, initialUnit);
    const raceID = calc.projectionDefaults[sport].raceID;
    const initial = calc.raceProjection(sport, raceID, original);
    const otherUnit = calc.sports[sport].units.find(x => x !== initialUnit);
    const converted = calc.projectionPace(original, sport, otherUnit);
    assert.ok(calc.parseClock(converted) > 0);
    assert.equal(calc.raceProjection(sport, raceID, original).seconds, initial.seconds);
  }
  assert.equal(calc.projectionRate("1:60", "swim", "yd"), null);
  assert.equal(calc.raceProjection("swim", "olympic", null), null);
  assert.equal(calc.raceProjection("run", "olympic", 0.5), null);
  assert.equal(calc.projectionRate("5:00", "run", "yd"), null);
});
