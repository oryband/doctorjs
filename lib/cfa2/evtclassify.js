#!/usr/bin/env node
;

var path = require('path');
var fs = require("fs");
var print = console.log,
    readFileSync = require('fs').readFileSync,
    spawn = require('child_process').spawn,
    parse = require('../../narcissus/lib/parser').parse,
    desugar = require('../../narcissus/lib/desugaring').desugar,
    classify_events = require('./jscfa').classify_events;

function printf(fd,s) { fs.writeSync(fd, s, null, 'utf8'); }

var addon = process.argv[2];
var coordsFile = process.argv[3];
var xpiFile = process.argv[4];
var resultsDir = process.argv[5] || ".";

try {
  var ast = desugar(parse(readFileSync(addon), addon, 1));
  var lines = ast.tokenizer.source.split("\n");
  var evts = classify_events(ast);

  // To use the script for debugging (i.e. call it directly on all.js), 
  // the next call should succeed even when argv[3] and up are missing.
  humanReadableResults(evts);
  
  var coords = parseCoords(readFileSync(coordsFile));
  var entries = [];
  var safe = 0, total = 0;
  for (var e in evts) {
    var ans = evts[e], r = ans.result;
    if (r) {
      total++;
      if (r[3] === "safe")
        safe++;
      var lineno = ans.lineno;
      var realPath = getRealPath(lineno, coords);
      entries.push({
          code: lines[lineno - 1],
          path: realPath.path,
          line: realPath.line,
          event: r[0].slice(0, -1),
          target: r[1],
          source: r[2],
          status: r[3]
      });
    }
  }

  var fd = fs.openSync(path.join(resultsDir, "evts"), "w", 0777);
  printf(fd, JSON.stringify({
    addon: xpiFile,
    listeners: entries,
    safe: safe,
    unsafe: total - safe
  }));
  fs.closeSync(fd);
  printResult("done");
} catch (e) {
  printResult("failed", e && e.stack);
  process.exit(1);
}

function humanReadableResults(evts) {
  var fd = fs.openSync(path.join(resultsDir, "hrevts"), "w", 0777);

  printf(fd,
         normStr("*Source code*", 80) + normStr("*Event name*", 20) +
         normStr("*Attached on*", 14) + normStr("*Came from*", 12) +
         "*Status*\n\n");

  var safe = 0;
  for (var e in evts) {
    var ans = evts[e], r;
    if (r = ans.result) {
      if (r[3] === "safe") ++safe;
      printf(fd,
             normStr(lines[ans.lineno - 1].replace(/^\s+/,""), 75) + "     " + 
             normStr(r[0].slice(0, -1), 20) + normStr(r[1], 14) + 
             normStr(r[2], 12) + r[3] + "\n");
    }
  }
  printf(fd, "\n");
  printf(fd, "Total: " + evts.analyzed + ",   Safe: " + safe + "\n");
  fs.closeSync(fd);
}

function parseCoords(src) {
  var obj = JSON.parse(src);
  var result = [];
  for (var key in obj) {
    var val = obj[key];
    if (typeof val === "number") {
      result.push({ line: val, realPath: key, realLine: 1 });
      continue;
    }
    for (var realLine in val)
      result.push({ line: val[realLine], realPath: key, realLine: realLine });
  }
  function compareLines(entry1, entry2) {
      return entry1.line < entry2.line
           ? -1
           : entry1.line > entry2.line
           ? 1
           : 0;
  }
  result.sort(compareLines);
  return result;
}

// line: 1-indexed
function getRealPath(line, coords) {
  var entry;
  for (var i = coords.length - 1; i >= 0; i--) {
    entry = coords[i];
    if (entry.line <= line)
      break;
  }
  var scriptOffset = line - entry.line;
  var scriptStart = entry.realLine;
  return {
    path: entry.realPath,
    line: scriptStart + scriptOffset
  };
}

function printResult(result, extras) {
  try {
    var fd = fs.openSync(path.join(resultsDir, "result"), "w", 0777);
    printf(fd, result + "\n");
    if (extras)
        printf(fd, extras);
    fs.closeSync(fd);
  } catch (e) { }
}

function normStr(s, l) {
  var diff = l - s.length;

  if (diff > 0)
    for (var i = 0; i < diff; i++) s += " ";
  else
    s = s.slice(0, s.length + diff);
  return s;
}
