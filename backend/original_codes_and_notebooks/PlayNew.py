import tkinter as tk
import matplotlib.pyplot as plt
import numpy as np
import networkx as nx
import matplotlib.cm as cm
import matplotlib.animation as animation
from matplotlib.colors import to_rgba

def plot_mcts_tree(node, depth_limit=3, focus_node_id=None, ai_win_prob=None, ax=None):
    """
    Dynamically plot and update the MCTS tree visualization with better space utilization.
    """
    # Initialize graph
    graph = nx.DiGraph()
    pos = {}

    def add_nodes_edges(node, parent=None, x=0, y=0, layer=1):
        node_id = id(node)
        graph.add_node(node_id, N=node.N, V=node.V, label=f'N: {node.N}, V: {node.V:.2f}')
        
        if parent is not None:
            graph.add_edge(parent, node_id)

        pos[node_id] = (x, y)

        if layer < depth_limit:
            child_offset = 0.5 ** layer
            for idx, child in enumerate(node.child.values()):
                offset_x = x + (idx - len(node.child) / 2) * child_offset
                add_nodes_edges(child, node_id, offset_x, y - 1, layer + 1)

    add_nodes_edges(node)

    # Extract node attributes
    labels = nx.get_node_attributes(graph, 'label')
    N_values = nx.get_node_attributes(graph, 'N')
    V_values = nx.get_node_attributes(graph, 'V')

    # Normalize node sizes and colors
    max_N = max(N_values.values()) if N_values else 1
    max_V = max(V_values.values()) if V_values else 1
    min_V = min(V_values.values()) if V_values else 0

    node_sizes = [300 + (N / max_N) * 1000 for N in N_values.values()]
    node_colors = [to_rgba(cm.coolwarm((V - min_V) / (max_V - min_V))) for V in V_values.values()]

    if ax is None:
        ax = plt.gca()
    ax.clear()

    # Highlight the most probable path
    if focus_node_id:
        try:
            highlight_path = nx.shortest_path(graph, source=id(node), target=focus_node_id)
            nx.draw_networkx_edges(
                graph, pos,
                edgelist=[(highlight_path[i], highlight_path[i + 1]) for i in range(len(highlight_path) - 1)],
                width=3, edge_color="gold", alpha=0.9, ax=ax
            )
        except nx.NetworkXNoPath:
            print("No path found to focus node.")

    # Depth blur: Use alpha transparency for nodes
    def depth_alpha(node_id):
        if focus_node_id and node_id == focus_node_id:
            return 1.0  # Fully visible
        return 0.5  # Partially transparent

    node_colors_with_alpha = [
        (*color[:3], depth_alpha(node_id)) for color, node_id in zip(node_colors, graph.nodes)
    ]

    nx.draw(
        graph, pos,
        labels=labels,
        with_labels=True,
        node_size=node_sizes,
        node_color=node_colors_with_alpha,  # Use RGBA colors with alpha transparency
        edge_color="gray",
        linewidths=1,
        font_size=10,
        font_color="black",
        ax=ax
    )

    # Add color bar for node values
    sm = cm.ScalarMappable(cmap=cm.coolwarm, norm=plt.Normalize(vmin=min_V, vmax=max_V))
    sm.set_array([])
    cbar = plt.colorbar(sm, ax=ax, label="Value (V)", orientation="vertical", pad=0.02, fraction=0.03)
    cbar.ax.tick_params(labelsize=8)

    # Dynamically set zoom level and adjust layout
    all_x = [pos[n][0] for n in pos]
    all_y = [pos[n][1] for n in pos]

    x_margin = 0.2 * (max(all_x) - min(all_x))
    y_margin = 0.5  # Reduced top margin for better layout
    ax.set_xlim(min(all_x) - x_margin, max(all_x) + x_margin)
    ax.set_ylim(min(all_y) - 0.5, max(all_y) + y_margin)

    # Add narrative overlays
    if ai_win_prob is not None:
        ax.text(
            0.5, -0.05, f"AI Winning Probability: {ai_win_prob:.2%}",
            transform=ax.transAxes, ha="center", va="center",
            fontsize=12, color="darkred", bbox=dict(facecolor="white", alpha=0.8, edgecolor="black")
        )

    ax.set_title("Monte Carlo Tree Search Visualization", fontsize=14, pad=20)
    plt.tight_layout()  # Optimize the layout
    plt.draw()
    plt.pause(0.01)


def visualize_ai_thinking(node, size):
    """
    Visualize the AI's thought process based on the MCTS tree.
    Args:
    - node: The current node in the MCTS tree.
    - size: The size of the game board (tuple).
    """
    # Initialize probabilities array with zeros
    probabilities = np.zeros(size)
    
    # If the node has children, calculate the probabilities based on visit count
    if node.child:
        total_visits = sum(child.N for child in node.child.values())
        for action, child in node.child.items():
            if total_visits > 0:
                probabilities[action] = child.N / total_visits

    # Create the plot
    fig, ax = plt.subplots()
    cax = ax.matshow(probabilities, cmap='coolwarm')

    # Add text annotations with probabilities
    for (i, j), val in np.ndenumerate(probabilities):
        ax.text(j, i, f'{val:.2f}', ha='center', va='center', color='black')

    # Add color bar and titles
    fig.colorbar(cax)
    ax.set_title('AI Move Probabilities')
    plt.xlabel('Column')
    plt.ylabel('Row')
    plt.show()

class PlayGUI:
    def __init__(self, game, player1=None, player2=None):
        self.game = game
        self.player1 = player1  # Human player or AI
        self.player2 = player2  # AI player
        self.end = False
        self.setup_ui()
        self.play_game()

    def setup_ui(self):
        self.root = tk.Tk()
        self.root.title('ConnectN Game')
        # Double the size of the canvas for a larger board
        self.canvas_width = 1200  # Adjusted from 300 to 600
        self.canvas_height = 1200  # Adjusted from 300 to 600
        self.canvas = tk.Canvas(self.root, width=self.canvas_width, height=self.canvas_height, borderwidth=0, highlightthickness=0)
        self.canvas.pack(side="top", fill="both", expand="true")
        self.rows = self.game.size[0]
        self.columns = self.game.size[1]
        self.cellwidth = self.canvas_width / self.columns
        self.cellheight = self.canvas_height / self.rows
        self.draw_board()

    def draw_board(self):
        for column in range(self.columns):
            for row in range(self.rows):
                x1 = column * self.cellwidth
                y1 = row * self.cellheight
                x2 = x1 + self.cellwidth
                y2 = y1 + self.cellheight
                self.canvas.create_rectangle(x1, y1, x2, y2, fill="white", tags="rect")
        self.canvas.bind("<Button-1>", self.cell_clicked)

    def cell_clicked(self, event):
        if self.end or (self.game.player == -1 and self.player2) or (self.game.player == 1 and self.player1):
            return  # Ignore clicks if the game is over or it's not human's turn
        column = int(event.x // self.cellwidth)
        row = int(event.y // self.cellheight)
        self.make_move((row, column))

    def make_move(self, move):
        success = self.game.move(move)
        if success:
            self.update_board()
            self.canvas.update_idletasks()  # Force the canvas to update immediately
            if self.game_over():
                self.end_game()
            else:
                self.trigger_ai_move()

    def trigger_ai_move(self):
        # Immediately triggers AI move after human's move if applicable
        if self.game.player == -1 and self.player2:
            self.ai_move(self.player2)
        elif self.game.player == 1 and self.player1:
            self.ai_move(self.player1)

    def ai_move(self, player_function):
        move, mytree = player_function(self.game)  # Your AI move decision logic
        print(1 - ((mytree.V + 1) / 2))
        if move is not None:
            self.make_move(move)
            # Compute AI Winning Probability
            if mytree is not None:
                # Normalize V to calculate probability
                ai_win_prob = 1 - ((mytree.V + 1) / 2)  # Convert V in [-1, 1] to probability [0, 1]
            else:
                ai_win_prob = 0.5  # Default to neutral probability if no tree is available

            plt.clf()  # Clear the current figure to avoid overlapping
            plt.cla()  # Clear the current axes
            depth_limit = max(5, 10 - self.game.n_moves)  # Example dynamic depth limiting
            plot_mcts_tree(
            node=mytree,
            depth_limit=depth_limit,
            focus_node_id=id(mytree),  # Focus on the AI's current decision node
            ai_win_prob=ai_win_prob
        )


    def visualize_ai_thinking(self):
        """
        Visualize the AI's thinking process by overlaying probability values on the board.
        Clear old probability numbers before showing new ones.
        """
        # Tag for all probability text items
        prob_tag = "prob_text"

        # Clear previous probability texts
        self.canvas.delete(prob_tag)

        # Simulated probabilities for each move (replace with your actual AI probabilities)
        probabilities = np.random.rand(self.rows, self.columns)  # Example probabilities

        for row in range(self.rows):
            for column in range(self.columns):
                prob = probabilities[row, column]
                
                # Calculate the position and size for text overlay
                x1 = column * self.cellwidth + self.cellwidth / 2
                y1 = row * self.cellheight + self.cellheight / 2
                
                # Create a text overlay on the canvas with the probability
                # Add the specific tag to this text item
                self.canvas.create_text(x1, y1, text=f"{prob:.2f}", font=("Arial", 14), fill="black", tags=prob_tag)
                
                # Optionally, wait a bit to simulate the AI "thinking"
                self.canvas.after(200)
                self.canvas.update_idletasks()

    def update_board(self):
        for column in range(self.columns):
            for row in range(self.rows):
                piece = self.game.state[row, column]
                if piece != 0:
                    x1 = column * self.cellwidth + self.cellwidth / 2
                    y1 = row * self.cellheight + self.cellheight / 2
                    color = "red" if piece == 1 else "blue"
                    self.canvas.create_oval(x1 - 25, y1 - 25, x1 + 25, y1 + 25, fill=color, tags="piece")

    def game_over(self):
        return self.game.score is not None

    def end_game(self):
        # Determine if the human player won, lost, or if the game was a tie
        if self.game.score is not None:
            # If player1 is None, the human player is playing as player1, and vice versa
            human_is_player1 = self.player1 is None
            human_won = (self.game.score == 1 and human_is_player1) or (self.game.score == -1 and not human_is_player1)
            game_tied = self.game.score == 0

            if human_won:
                message = "You Win!"
            elif game_tied:
                message = "Game Tied"
            else:
                message = "You Lose"
        else:
            message = "Game Tied"  # Fallback case, though score should not be None here

        print(message)
        self.show_message_dialog(message)

    def play_game(self):
        self.root.after(100, self.initial_ai_move)  # Give control to the AI if it's the first player
        self.root.mainloop()

    def initial_ai_move(self):
        # If AI is set as player1, make the first move
        if self.player1 and self.game.player == 1:
            self.ai_move(self.player1)

    def show_message_dialog(self, message):
        # Create a top-level window for the message dialog
        dialog = tk.Toplevel(self.root)
        dialog.title("Game Over")
        
        # Set the size of the dialog
        dialog.geometry("400x200")  # Width x Height

        # Create a label for the message text
        message_label = tk.Label(dialog, text=message, font=("Arial", 20))
        message_label.pack(expand=True)

        # Create an OK button to close the dialog
        ok_button = tk.Button(dialog, text="OK", command=dialog.destroy, height=2, width=10)
        ok_button.pack(pady=20)

        # Make the dialog modal
        dialog.transient(self.root)  # Set to be on top of the main window
        dialog.grab_set()  # Prevent interaction with the main window until this one is closed
        self.root.wait_window(dialog)  # Wait here until the dialog is closed



