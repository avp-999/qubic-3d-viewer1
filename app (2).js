import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';

const $ = (selector) => document.querySelector(selector);
const ui = {
  loadStatus: $('#load-status'), error: $('#error-message'), nodeId: $('#node-id'), moveNumber: $('#move-number'),
  depth: $('#depth'), children: $('#children-count'), turnToken: $('#turn-token'), turnLabel: $('#turn-label'),
  terminal: $('#terminal-badge'), prev: $('#prev-button'), next: $('#next-button'), reset: $('#reset-button'),
  branch: $('#branch-select'), timeline: $('#timeline'), timelineValue: $('#timeline-value'),
  sidebar: $('#sidebar'), collapse: $('#toggle-sidebar'), expand: $('#expand-sidebar')
};

// ---------- Escena 3D ----------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070b16, 0.018);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
camera.position.set(7.8, 6.6, 9.3);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
$('#canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 18;
controls.target.set(0, 0, 0);
scene.add(new THREE.AmbientLight(0x91b7dc, 1.2));
const keyLight = new THREE.PointLight(0x8feeff, 28, 28);
keyLight.position.set(4, 7, 8);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0x4778ff, 16, 24);
fillLight.position.set(-7, -2, -5);
scene.add(fillLight);

const board = new THREE.Group();
const tokenGroup = new THREE.Group();
const winnerGroup = new THREE.Group();
scene.add(board);
board.add(tokenGroup, winnerGroup);
const coordinates = [-1.6, 0, 1.6];
const cellPosition = ([x, y, z]) => new THREE.Vector3(coordinates[x], coordinates[y], coordinates[z]);

function buildBoard() {
  const cube = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(4.85, 4.85, 4.85)),
    new THREE.LineBasicMaterial({ color: 0x6deaff, transparent: true, opacity: 0.34 })
  );
  board.add(cube);
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x547797, transparent: true, opacity: 0.42 });
  for (const axis of ['x', 'y', 'z']) {
    for (const a of coordinates) for (const b of coordinates) {
      const points = [-2.4, 2.4].map((edge) => {
        const p = { x: a, y: b, z: a };
        p[axis] = edge;
        if (axis === 'x') { p.y = a; p.z = b; }
        if (axis === 'y') { p.x = a; p.z = b; }
        if (axis === 'z') { p.x = a; p.y = b; }
        return new THREE.Vector3(p.x, p.y, p.z);
      });
      board.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMaterial));
    }
  }
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5.7, 64),
    new THREE.MeshBasicMaterial({ color: 0x0d1b2d, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.44;
  board.add(floor);
}
buildBoard();

// Todas las líneas de 3 celdas del cubo: ejes, diagonales de caras y diagonales espaciales.
const winningCombos = [];
const addCombo = (a, b, c) => winningCombos.push([a, b, c]);
for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) addCombo([x, y, 0], [x, y, 1], [x, y, 2]);
for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) addCombo([x, 0, z], [x, 1, z], [x, 2, z]);
for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) addCombo([0, y, z], [1, y, z], [2, y, z]);
for (const fixed of [0, 1, 2]) {
  addCombo([0, 0, fixed], [1, 1, fixed], [2, 2, fixed]);
  addCombo([0, 2, fixed], [1, 1, fixed], [2, 0, fixed]);
  addCombo([fixed, 0, 0], [fixed, 1, 1], [fixed, 2, 2]);
  addCombo([fixed, 0, 2], [fixed, 1, 1], [fixed, 2, 0]);
  addCombo([0, fixed, 0], [1, fixed, 1], [2, fixed, 2]);
  addCombo([0, fixed, 2], [1, fixed, 1], [2, fixed, 0]);
}
addCombo([0, 0, 0], [1, 1, 1], [2, 2, 2]);
addCombo([0, 0, 2], [1, 1, 1], [2, 2, 0]);
addCombo([0, 2, 0], [1, 1, 1], [2, 0, 2]);
addCombo([2, 0, 0], [1, 1, 1], [0, 2, 2]);

function clearGroup(group) {
  while (group.children.length) {
    const object = group.children.pop();
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
    else object.material?.dispose();
  }
}
function drawToken(move) {
  const color = move.player === 'X' ? 0xff5268 : 0x438fff;
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, metalness: 0.25, roughness: 0.22 });
  const token = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), material);
  token.position.copy(cellPosition(move.move));
  tokenGroup.add(token);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending }));
  token.add(glow);
}
function drawWinnerLine(combo) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(combo.map(cellPosition)),
    new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.98 })
  );
  line.userData.winner = true;
  winnerGroup.add(line);
}

// ---------- Modelo del DAG ----------
let graph = null;
let path = [];
let currentNode = null;

function normalizeGraph(data) {
  if (!data || typeof data !== 'object') throw new Error('solution.json no contiene un objeto JSON.');
  if (data.nodes && data.root_id && data.nodes[data.root_id]) {
    const nodes = Object.fromEntries(Object.entries(data.nodes).map(([id, node]) => [id, {
      id,
      move: Array.isArray(node.move) ? node.move : null,
      player: String(node.player || '').toUpperCase(),
      is_terminal: Boolean(node.is_terminal),
      winner: node.winner ? String(node.winner).toUpperCase() : null,
      children: Array.isArray(node.children) ? node.children.map(String) : []
    }]));
    return { rootId: String(data.root_id), nodes };
  }
  throw new Error('Formato no compatible: se esperaba { root_id, nodes }.');
}
function getNode(id) {
  const node = graph?.nodes[id];
  if (!node) throw new Error(`El nodo «${id}» no existe en solution.json.`);
  return node;
}
// En el formato del DAG, `player` representa el jugador que tiene el turno
// en ese nodo. Por eso la jugada almacenada en el nodo hijo la realiza el
// jugador indicado por el nodo padre.
function boardMoves() {
  return path.slice(1).map((id) => {
    const node = getNode(id);
    const previous = path[path.indexOf(id) - 1] ? getNode(path[path.indexOf(id) - 1]) : null;
    const inferred = previous?.player === 'X' ? 'O' : previous?.player === 'O' ? 'X' : node.player;
    return { move: node.move, player: inferred };
  }).filter((item) => Array.isArray(item.move));
}
function findWinningCombos(moves) {
  const cells = new Map(moves.map((item) => [item.move.join(','), item.player]));
  return winningCombos.filter((combo) => {
    const players = combo.map((cell) => cells.get(cell.join(',')));
    return players[0] && players.every((player) => player === players[0]);
  });
}
function currentWinner(node, moves) {
  if (node.winner) return node.winner;
  const combo = findWinningCombos(moves)[0];
  if (!combo) return null;
  const cells = new Map(moves.map((item) => [item.move.join(','), item.player]));
  return cells.get(combo[0].join(',')) || null;
}

function refreshBranchOptions() {
  const children = currentNode ? currentNode.children : [];
  ui.branch.replaceChildren();
  if (!children.length) {
    ui.branch.add(new Option('No hay ramas disponibles', ''));
    ui.branch.disabled = true;
    return;
  }
  children.forEach((childId, index) => {
    const child = getNode(childId);
    const label = child.move ? `${index + 1}. ${childId} · ${child.player} [${child.move.join(', ')}]` : `${index + 1}. ${childId}`;
    ui.branch.add(new Option(label, childId));
  });
  ui.branch.disabled = false;
  ui.branch.selectedIndex = 0;
}
function renderNode() {
  currentNode = getNode(path[path.length - 1]);
  const moves = boardMoves();
  const winning = findWinningCombos(moves);
  clearGroup(tokenGroup);
  clearGroup(winnerGroup);
  moves.forEach(drawToken);
  winning.forEach(drawWinnerLine);

  const terminal = currentNode.is_terminal || winning.length > 0;
  const nextPlayer = currentNode.player === 'X' || currentNode.player === 'O' ? currentNode.player : (moves.length % 2 === 0 ? 'X' : 'O');
  const winner = currentWinner(currentNode, moves);
  ui.nodeId.textContent = currentNode.id;
  ui.moveNumber.textContent = `${moves.length} / 27`;
  ui.depth.textContent = String(path.length - 1);
  ui.children.textContent = String(currentNode.children.length);
  ui.turnToken.textContent = terminal ? '✓' : nextPlayer;
  ui.turnToken.className = `turn-token turn-token--${nextPlayer.toLowerCase()}`;
  ui.turnLabel.textContent = terminal ? `Victoria de ${winner || 'X'}` : `Turno de ${nextPlayer}`;
  ui.terminal.classList.toggle('hidden', !terminal);
  ui.prev.disabled = path.length <= 1;
  ui.next.disabled = currentNode.children.length === 0;
  ui.timeline.max = String(Math.max(0, path.length - 1));
  ui.timeline.value = String(path.length - 1);
  ui.timelineValue.textContent = `${path.length - 1} / ${Math.max(0, path.length - 1)}`;
  refreshBranchOptions();
}
function goToNode(id) {
  if (!currentNode?.children.includes(id)) return;
  path.push(id);
  renderNode();
}
function goNext() { if (currentNode?.children[0]) goToNode(currentNode.children[0]); }
function goBack() { if (path.length > 1) { path.pop(); renderNode(); } }
function reset() { if (graph) { path = [graph.rootId]; renderNode(); } }

// ---------- Carga, controles y ciclo de render ----------
async function loadSolution() {
  const candidates = ['./solution.json', '../solution.json'];
  let lastError = null;
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      graph = normalizeGraph(await response.json());
      path = [graph.rootId];
      ui.loadStatus.textContent = `DAG cargado · ${Object.keys(graph.nodes).length} nodos`;
      ui.error.classList.add('hidden');
      renderNode();
      return;
    } catch (error) { lastError = error; }
  }
  throw new Error(`No se pudo cargar solution.json desde ./solution.json ni ../solution.json. ${lastError?.message || ''}`);
}
ui.prev.addEventListener('click', goBack);
ui.next.addEventListener('click', goNext);
ui.reset.addEventListener('click', reset);
ui.branch.addEventListener('change', (event) => goToNode(event.target.value));
ui.timeline.addEventListener('input', (event) => {
  const targetDepth = Number(event.target.value);
  if (targetDepth === 0) return reset();
  if (targetDepth < path.length) { path = path.slice(0, targetDepth + 1); renderNode(); }
});
ui.collapse.addEventListener('click', () => { ui.sidebar.classList.add('is-collapsed'); ui.expand.classList.remove('hidden'); });
ui.expand.addEventListener('click', () => { ui.sidebar.classList.remove('is-collapsed'); ui.expand.classList.add('hidden'); });
addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') goBack();
  if (event.key === 'ArrowRight') goNext();
  if (event.key.toLowerCase() === 'r') reset();
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

loadSolution().catch((error) => {
  ui.loadStatus.textContent = 'Error de carga';
  ui.error.textContent = error.message;
  ui.error.classList.remove('hidden');
  ui.prev.disabled = true;
  ui.next.disabled = true;
});
addEventListener('error', (event) => {
  if (!event.error) return;
  ui.loadStatus.textContent = 'Error de ejecución';
  ui.error.textContent = `La interfaz encontró un error: ${event.error.message || event.message}`;
  ui.error.classList.remove('hidden');
});
addEventListener('unhandledrejection', (event) => {
  ui.loadStatus.textContent = 'Error de ejecución';
  ui.error.textContent = `Error no controlado: ${event.reason?.message || event.reason}`;
  ui.error.classList.remove('hidden');
});
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  winnerGroup.children.forEach((line, index) => line.scale.setScalar(1 + Math.sin(performance.now() * 0.004 + index) * 0.025));
  renderer.render(scene, camera);
}
animate();
