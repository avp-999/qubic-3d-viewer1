import json
from pathlib import Path

# Solución práctica: explora todas las jugadas legales desde la apertura central
# hasta MAX_PLIES. La profundidad se puede aumentar, pero el JSON crecerá mucho.
MAX_PLIES = 7
OUT = Path(__file__).with_name('solution.json')

# Líneas del tres en raya 3D 3x3x3.
LINES = []
for dx in range(-1, 2):
    for dy in range(-1, 2):
        for dz in range(-1, 2):
            if (dx, dy, dz) == (0, 0, 0):
                continue
            for x in range(3):
                for y in range(3):
                    for z in range(3):
                        end = (x + 2 * dx, y + 2 * dy, z + 2 * dz)
                        if all(0 <= value < 3 for value in end):
                            line = tuple((x + i * dx, y + i * dy, z + i * dz) for i in range(3))
                            if line not in LINES and tuple(reversed(line)) not in LINES:
                                LINES.append(line)

# Columnar gravity: each (x,z) column fills y=0, then y=1, then y=2.
COLUMNS = [(x, z) for x in range(3) for z in range(3)]
EMPTY = 0
X = 1
O = 2
nodes = {}
key_to_id = {}
next_id = 0


def winner(board):
    found = set()
    for line in LINES:
        values = [board[x + 3 * y + 9 * z] for x, y, z in line]
        if values[0] and values.count(values[0]) == 3:
            found.add(values[0])
    if X in found:
        return 'X'
    if O in found:
        return 'O'
    return None


def board_move(board, column, player):
    x, z = column
    result = list(board)
    for y in range(3):
        index = x + 3 * y + 9 * z
        if result[index] == EMPTY:
            result[index] = player
            return tuple(result), [x, y, z]
    return None, None


def make_id():
    global next_id
    value = f'n{next_id}'
    next_id += 1
    return value


def expand(board, player, ply, parent_move=None, parent_player=None):
    # Reutiliza posiciones idénticas: es un DAG, no un árbol duplicado.
    key = (board, player)
    if key in key_to_id:
        return key_to_id[key]

    node_id = make_id()
    key_to_id[key] = node_id
    terminal_winner = winner(board)
    occupied = sum(value != EMPTY for value in board)
    terminal = terminal_winner is not None or occupied == 27
    node = {
        'id': node_id,
        'move': parent_move,
        'player': 'X' if player == X else 'O',
        'is_terminal': terminal,
        'winner': terminal_winner,
        'status': 'terminal' if terminal else ('depth_limit' if ply >= MAX_PLIES else 'open'),
        'children': []
    }
    nodes[node_id] = node
    if terminal or ply >= MAX_PLIES:
        return node_id

    next_player = O if player == X else X
    # Ordena primero columnas cercanas al centro para mostrar una línea natural.
    ordered_columns = sorted(COLUMNS, key=lambda col: abs(col[0] - 1) + abs(col[1] - 1))
    for column in ordered_columns:
        child_board, applied_move = board_move(board, column, player)
        if child_board is None:
            continue
        child_id = expand(child_board, next_player, ply + 1, applied_move, player)
        node['children'].append(child_id)
    return node_id

# Apertura solicitada: centro absoluto. Con gravedad la ficha cae a y=0 de su columna.
empty = tuple([EMPTY] * 27)
opening_board, opening_applied = board_move(empty, (1, 1), X)
root_id = make_id()
nodes[root_id] = {
    'id': root_id, 'move': None, 'player': 'X', 'is_terminal': False,
    'winner': None, 'status': 'opening', 'children': []
}
opening_id = expand(opening_board, O, 1, opening_applied, X)
nodes[root_id]['children'] = [opening_id]

payload = {
    'version': 2,
    'game': 'tic-tac-toe-3d-3x3x3',
    'physics': 'visual-only',
    'max_plies': MAX_PLIES,
    'complete_to_depth': True,
    'opening': {'requested_move': [1, 1, 1], 'applied_with_gravity': opening_applied},
    'description': f'DAG práctico: todas las jugadas legales hasta {MAX_PLIES} plies desde la apertura central.',
    'root_id': root_id,
    'nodes': nodes
}
OUT.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
print(f'Escrito {OUT}')
print(f'Nodos: {len(nodes)} | terminales: {sum(n["is_terminal"] for n in nodes.values())} | profundidad: {MAX_PLIES}')
