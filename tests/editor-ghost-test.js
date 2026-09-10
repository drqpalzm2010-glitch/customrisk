// Regression test for the editor "ghost territory" bug:
// 1) Ctrl+Z (undo) of a drawn territory must also purge it from every
//    continent's territoryIds, or the dead ID permanently blocks that
//    continent's reinforcement bonus.
// 2) The "Fix Ghost Territories" editor tool must list & remove pre-existing
//    ghosts and be safely undoable itself.
// 3) Server-side confirm: removing ghosts restores the continent bonus.
//
// Run with: node tests/editor-ghost-test.js
'use strict';

process.env.USER_DB_PATH = require('path').join(__dirname, 'test_users_data.json');
const fs = require('fs');
const vm = require('vm');
const GameEngine = require('../server/game-engine');

let passCount = 0;
let failCount = 0;
function ok(cond, label) {
  if (cond) { passCount++; console.log(`  OK ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}`); }
}

// ---------------------------------------------------------------
// Minimal DOM harness so the (browser-only) MapEditor can run in Node
// ---------------------------------------------------------------
const toasts = [];
const showConfirmCalls = [];

function makeStubElement(id) {
  return {
    id,
    style: {},
    dataset: {},
    files: [],
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return makeStubElement(`${id}>q`); },
    querySelectorAll() { return []; },
    createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: 0, y: 0 }; } }; },
    getScreenCTM() { return { inverse() { return { x: 0, y: 0 }; } }; }
  };
}

const elCache = {};
const windowStub = {
  addEventListener() {},
  showToast(msg, type) { toasts.push({ msg, type }); },
  showConfirm(message, options) {
    const p = Promise.resolve(true); // auto-confirm
    showConfirmCalls.push({ message, options });
    return p;
  },
  SVGRenderer: class {
    constructor() { this.options = {}; this.svg = makeStubElement('svg'); }
    render() {}
    highlightContinent() {}
    clearContinentHighlight() {}
  },
  MainController: { showScreen() {} },
  SocketClient: function() {},
  MapEditor: null
};
const documentStub = {
  body: makeStubElement('body'),
  getElementById(id) { return elCache[id] || (elCache[id] = makeStubElement(id)); },
  createElement() { return makeStubElement('created'); },
  createElementNS() { return makeStubElement('ns'); },
  addEventListener() {},
  querySelectorAll() { return []; }
};

global.window = windowStub;
global.document = documentStub;
global.localStorage = { getItem() { return null; }, setItem() {} };
global.alert = () => {};
global.confirm = () => true;
global.setInterval = () => 0; // keep autosave from holding the process open
global.clearInterval = () => {};

vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '../public/js/editor.js'), 'utf8'));
const editor = new windowStub.MapEditor();

function freshMap() {
  return {
    mapName: 'Ghost Test',
    width: 800,
    height: 600,
    referenceImage: '',
    imageOpacity: 0.5,
    territories: [
      { id: 't1', name: 'Alpha', points: [[0,0],[10,0],[10,10],[0,10]] },
      { id: 't2', name: 'Beta', points: [[20,0],[30,0],[30,10],[20,10]] },
      { id: 't3', name: 'Gamma', points: [[40,0],[50,0],[50,10],[40,10]] }
    ],
    connections: [['t1', 't2']],
    continents: [
      { id: 'c1', name: 'Northland', bonus: 5, territoryIds: ['t1', 't2', 't3'] }
    ],
    isScenario: false,
    scenarioSettings: { capitalRush: false, defaultDummyArmies: 1 },
    nations: []
  };
}

function resetEditorDom() {
  for (const k of Object.keys(elCache)) delete elCache[k];
  toasts.length = 0;
  showConfirmCalls.length = 0;
}

(async () => {
  console.log('\nEditor Ghost Territory Regression Tests');
// TEST 1: undo of an add-territory purges continents
  console.log('1. Ctrl+Z on a newly added (and continent-assigned) territory...');
  resetEditorDom();
  editor.mapData = freshMap();
  editor.mapData.territories.push({ id: 't4', name: 'Delta', points: [[60,0],[70,0],[70,10],[60,10]] });
  editor.mapData.continents[0].territoryIds.push('t4');
  editor.pushToUndo('add-territory', { id: 't4' });

  editor.undo(); // Ctrl+Z

  ok(editor.mapData.territories.every(t => t.id !== 't4'), 'territory t4 is gone from territories');
  ok(!editor.mapData.continents[0].territoryIds.includes('t4'),
    'ghost reference t4 is purged from continent territoryIds (no ghost created)');
  ok(editor.mapData.territories.length === 3, 'remaining territories unchanged');

  // TEST 2: ghosts created BEFORE the fix are cleaned by the tool
  console.log('\n2. "Fix Ghost Territories" tool removes pre-existing ghosts...');
  resetEditorDom();
  editor.mapData = freshMap();
  editor.mapData.continents[0].territoryIds.push('ghost_111', 'ghost_222');
  editor.mapData.continents.push({ id: 'c2', name: 'Southland', bonus: 3, territoryIds: ['t1', 'ghost_333'] });

  await editor.detectAndRemoveGhostTerritories();

  ok(showConfirmCalls.length === 1, 'confirmation dialog was shown');
  ok(showConfirmCalls[0].options && showConfirmCalls[0].options.danger === true, 'dialog is danger-styled');
  ok(/ghost_111/.test(showConfirmCalls[0].message), 'dialog message lists found ghosts');
  ok(/3 ghost territory reference/.test(showConfirmCalls[0].message), 'dialog reports correct count (3)');

  const c1E = editor.mapData.continents.find(c => c.id === 'c1');
  const c2E = editor.mapData.continents.find(c => c.id === 'c2');
  ok(!c1E.territoryIds.includes('ghost_111') && !c1E.territoryIds.includes('ghost_222'),
    'c1 ghost references removed');
  ok(!c2E.territoryIds.includes('ghost_333'), 'c2 ghost references removed');
  ok(c1E.territoryIds.length === 3 && c2E.territoryIds.length === 1,
    'valid territory references preserved');
  ok(toasts.some(t => /Removed 3 ghost/.test(t.msg)), 'success toast shown after removal');

  const top = editor.undoStack[editor.undoStack.length - 1];
  ok(top && top.type === 'remove-ghost-ids' && top.data.entries.length === 3,
    'cleanup pushed an undoable remove-ghost-ids entry');
  editor.undo();
  ok(c1E.territoryIds.includes('ghost_111') && c1E.territoryIds.includes('ghost_222') && c2E.territoryIds.includes('ghost_333'),
    'Ctrl+Z restores the ghost references (cleanup is undoable)');

  // TEST 3: clean maps are a friendly no-op
  console.log('\n3. Clean map triggers no dialog...');
  resetEditorDom();
  editor.mapData = freshMap();
  await editor.detectAndRemoveGhostTerritories();
  ok(showConfirmCalls.length === 0, 'no confirmation dialog on a clean map');
  ok(toasts.some(t => /No ghost territories found/.test(t.msg)), 'informational toast shown');
  editor.mapData.continents.push({ id: 'cLegacy', name: 'Legacy', bonus: 1 }); // no territoryIds
  await editor.detectAndRemoveGhostTerritories();
  ok(showConfirmCalls.length === 0, 'legacy continent without territoryIds handled safely');

  // TEST 4: server-side continent bonus is blocked by ghosts, restored after cleanup
  console.log('\n4. Server calculates bonus correctly after ghost removal...');
  function reinforcementsWithTerritoryIds(territoryIds) {
    const mapData = {
      territories: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      continents: [{ id: 'c1', name: 'Northland', bonus: 5, territoryIds }]
    };
    const state = {
      players: [{ id: 'p1', name: 'A', eliminated: false }],
      territories: {
        t1: { ownerId: 'p1', armies: 3 },
        t2: { ownerId: 'p1', armies: 3 },
        t3: { ownerId: 'p1', armies: 3 }
      }
    };
    return GameEngine.calculateReinforcements(state, mapData, 'p1');
  }
  const withGhost = reinforcementsWithTerritoryIds(['t1', 't2', 't3', 'ghost_111']);
  const afterCleanup = reinforcementsWithTerritoryIds(['t1', 't2', 't3']);
  ok(withGhost === 3, `ghost blocks the +5 continent bonus (got ${withGhost}, expected 3)`);
  ok(afterCleanup === 8, `continent bonus restored after ghost removal (got ${afterCleanup}, expected 8)`);

  console.log(`\n${passCount} passed, ${failCount} failed\n`);
  process.exitCode = failCount === 0 ? 0 : 1;
})();