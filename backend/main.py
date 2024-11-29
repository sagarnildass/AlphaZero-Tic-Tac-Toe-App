from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ConnectN import ConnectN
import MCTS
import torch
from copy import deepcopy, copy
import uvicorn
import json
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from policy import Policy
import sys
import math
from fastapi.middleware.cors import CORSMiddleware


sys.modules['__main__'] = sys.modules[__name__]

# Initialize FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AI_PLAYER = -1

# Initialize the game settings
game_setting = {'size': (6,6), 'N':4}

# Load the policy
game = ConnectN(**game_setting)
policy = Policy(game)
# Load the saved model (adjust the path if necessary)
challenge_policy = torch.load('6-6-4-pie.policy')

# policy.eval()

# Define a Pydantic model for the move
class Move(BaseModel):
    row: int
    col: int

# Initialize the game
game = ConnectN(**game_setting)

# Endpoint to start a new game
@app.post("/start_game")
def start_game():
    global game
    game = ConnectN(**game_setting)
    return {
        "status": "Game started",
        "board": game.state.tolist(),
        "player": int(game.player)
    }

# Endpoint to make a move
@app.post("/make_move")
def make_move(move: Move):
    global game
    if game.score is not None:
        return {"status": "Game over", "winner": int(game.score)}
    success = game.move((move.row, move.col))
    if success:
        winner = game.get_score()
        return {
            "status": "success",
            "board": game.state.tolist(),
            "player": int(game.player),
            "winner": int(winner) if winner is not None else None
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid move")

# Endpoint to get the current board
@app.get("/get_board")
def get_board():
    global game
    winner = game.get_score()
    return {
        "board": game.state.tolist(),
        "player": int(game.player),
        "winner": int(winner) if winner is not None else None
    }

# Endpoint for the AI to make a move
@app.get("/ai_move")
def ai_move():
    global game, last_mytree
    if game.score is not None:
        return {"status": "Game over", "winner": int(game.score)}
    # Perform AI move
    move, mytree = Challenge_Player_MCTS(game)
    success = game.move(move)
    if success:
        winner = game.get_score()
        # Save the last MCTS tree for visualization
        last_mytree = mytree
        print(f"Last MCTS Tree Updated: {last_mytree}")  # Debug log
        return {
            "status": "success",
            "move": [int(move[0]), int(move[1])],
            "board": game.state.tolist(),
            "player": int(game.player),
            "winner": int(winner) if winner is not None else None
        }
    else:
        raise HTTPException(status_code=400, detail="AI move failed")
    
@app.get("/ai_probability")
def ai_probability():
    """
    Compute and return the AI's probability of winning at the current state.
    """
    global game, challenge_policy

    if game.score is not None:
        return {
            "status": "Game over",
            "winner": int(game.score),
            "probability_of_winning": None
        }

    # Process the current game state with the AI policy
    frame = torch.tensor(game.state * AI_PLAYER, dtype=torch.float, device="cpu").unsqueeze(0).unsqueeze(0)
    _, value = challenge_policy(frame)

    # Transform value into a probability of AI winning
    probability_of_winning = ((value.item() + 1) / 2)  # Convert from [-1, 1] range to [0, 1]

    return {
        "status": "In progress",
        "probability_of_winning": probability_of_winning
    }

# Function for the AI to select a move using MCTS
def Challenge_Player_MCTS(game):
    mytree = MCTS.Node(copy(game))
    for _ in range(1000):
        mytree.explore(challenge_policy)
       
    mytreenext, (v, nn_v, p, nn_p) = mytree.next(temperature=0.1)
    
    return mytreenext.game.last_move, mytree  # Now returns the move and MCTS root

# Endpoint to get MCTS tree data
@app.get("/get_mcts_tree")
def get_mcts_tree(max_depth: int = 3):
    global last_mytree
    if last_mytree is None:
        print("No MCTS tree available")  # Debug log
        return {"tree": None}
    try:
        tree_data = extract_mcts_tree_data(last_mytree, max_depth=max_depth)  # Limit depth to 3
        return {"tree": tree_data}
    except Exception as e:
        print(f"Error serializing MCTS tree: {e}")  # Debug log
        return {"tree": None}
    
@app.get("/get_mcts_subtree")
def get_mcts_subtree(node_id: int, max_depth: int = 2):
    global last_mytree
    if last_mytree is None:
        print("No MCTS tree available")  # Debug log
        return {"tree": None}
    try:
        # Get best_path_ids from the root
        best_path_ids = get_best_path_ids(last_mytree)
        subtree = extract_node_by_id(last_mytree, node_id, max_depth=max_depth, best_path_ids=best_path_ids)
        if subtree is None:
            return {"tree": None, "error": "Node not found"}
        return {"tree": subtree}
    except Exception as e:
        print(f"Error serializing MCTS subtree: {e}")  # Debug log
        return {"tree": None}
    
@app.get("/get_mcts_summary")
def get_mcts_summary():
    global last_mytree
    if last_mytree is None:
        return {"summary": None}
    return {"summary": summarize_mcts_tree(last_mytree)}
    
def extract_node_by_id(node, target_id, max_depth=2, current_depth=0, best_path_ids=None):
    if id(node) == target_id:
        return extract_mcts_tree_data(node, max_depth=max_depth, current_depth=current_depth, best_path_ids=best_path_ids)
    for child in node.child.values():
        result = extract_node_by_id(child, target_id, max_depth, current_depth, best_path_ids)
        if result:
            return result
    return None


# Function to extract MCTS tree data
def extract_mcts_tree_data(node, max_depth=2, current_depth=0, best_path_ids=None):
    def sanitize_float(value):
        if isinstance(value, (float, int)) and (math.isinf(value) or math.isnan(value)):
            return 0.0
        elif isinstance(value, torch.Tensor):
            return value.item() if value.numel() == 1 else value.tolist()
        return value

    if current_depth == 0:
        # Compute the most promising path IDs at the root call
        best_path_ids = get_best_path_ids(node)

    if current_depth >= max_depth:
        return {"id": id(node), "children": None}  # Stop at max depth

    def node_to_dict(node, depth):
        node_dict = {
            'id': id(node),
            'N': sanitize_float(node.N),
            'V': sanitize_float(node.V),
            'U': sanitize_float(node.U),
            'prob': sanitize_float(node.prob),
            'is_best_path': id(node) in best_path_ids,
            'children': []
        }
        if depth < max_depth:
            for action, child in node.child.items():
                child_dict = node_to_dict(child, depth + 1)
                child_dict['action'] = [int(action[0]), int(action[1])]
                node_dict['children'].append(child_dict)
        return node_dict

    return node_to_dict(node, current_depth)

def get_best_path_ids(node):
    # Recursively find the path with the highest cumulative N
    path_ids = []

    def recurse(node):
        path_ids.append(id(node))
        if node.child:
            # Select child with the highest N
            best_child = max(node.child.values(), key=lambda c: c.N)
            recurse(best_child)

    recurse(node)
    return set(path_ids)

def summarize_mcts_tree(node):
    def aggregate(node):
        total_nodes = 1
        total_N = node.N
        total_V = node.V
        for child in node.child.values():
            child_nodes, child_N, child_V = aggregate(child)
            total_nodes += child_nodes
            total_N += child_N
            total_V += child_V
        return total_nodes, total_N, total_V

    total_nodes, total_N, total_V = aggregate(node)
    return {
        "total_nodes": total_nodes,
        "average_N": total_N / total_nodes,
        "average_V": total_V / total_nodes,
    }

# Initialize the last MCTS tree
last_mytree = None

# Run the app
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)