// src/App.js

import React, { useState, useEffect } from "react";
import GameBoard from "./components/GameBoard";
import axios from "axios";
import { ClipLoader } from "react-spinners";
import MctsTree from "./components/MctsTree";
import Card from "./components/Card";
import {
  RadialBarChart,
  RadialBar,
  Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [board, setBoard] = useState([]);
  const [player, setPlayer] = useState(1);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mctsTreeData, setMctsTreeData] = useState(null);
  const [treeDepth, setTreeDepth] = useState(3);
  const [mctsSummary, setMctsSummary] = useState(null);
  const [aiProbability, setAiProbability] = useState(null);
  const [maxN, setMaxN] = useState(1);
  const [maxV, setMaxV] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerOrder, setPlayerOrder] = useState(null); // 1 for first, -1 for second
  const [selectedNodeData, setSelectedNodeData] = useState(null); // Node Information

  const API_BASE_URL = "http://localhost:8000";

  // useEffect(() => {
  //   // Remove the initial startGame call
  //   // startGame();
  // }, []);

  const startGame = async (playerChoice) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/start_game`, {
        player: playerChoice,
      });
      setBoard(response.data.board);
      setPlayer(response.data.player);
      setWinner(null);
      setMessage(
        playerChoice === 1
          ? "Game started! You're player X"
          : "Game started! AI is player X"
      );
      setMctsTreeData(null); // Reset MCTS data
      setMctsSummary(null);
      setAiProbability(null); // Reset AI probability
      setGameStarted(true);
      setPlayerOrder(playerChoice);
      if (playerChoice === -1) {
        // Player chose to be second, AI starts
        setMessage("AI's turn...");
        await aiMove();
        await fetchAiProbability();
      } else {
        setMessage("Your turn");
      }
    } catch (error) {
      console.error("Error starting game:", error);
      setMessage("Error starting game.");
    }
  };

  const onCellClick = async (row, col) => {
    if (winner !== null || board[row][col] !== 0) return;

    try {
      // Player makes a move
      const response = await axios.post(`${API_BASE_URL}/make_move`, {
        row,
        col,
      });
      setBoard(response.data.board);
      setPlayer(response.data.player);

      if (response.data.winner !== null) {
        setWinner(response.data.winner);
        setMessage(`Player ${response.data.winner === 1 ? "X" : "O"} wins!`);
        setMctsTreeData(null); // Reset MCTS data
        setMctsSummary(null);
        setAiProbability(null); // Reset AI probability
      } else {
        setMessage("AI's turn...");
        // AI makes a move
        await aiMove();
        await fetchAiProbability();
      }

      // Fetch MCTS tree and select the node corresponding to the last played action
      await fetchMctsTree();
      setSelectedNodeData(findNodeByAction([row, col])); // Select the last played node
    } catch (error) {
      console.error("Error making move:", error);
      if (error.response && error.response.data.detail) {
        setMessage(error.response.data.detail);
      }
    }
  };

  const aiMove = async () => {
    try {
      setLoading(true); // Start loading
      const response = await axios.get(`${API_BASE_URL}/ai_move`);
      setBoard(response.data.board);
      setPlayer(response.data.player);
      setLoading(false); // Stop loading

      if (response.data.winner !== null) {
        setWinner(response.data.winner);
        setMessage(`Player ${response.data.winner === 1 ? "X" : "O"} wins!`);
        setMctsTreeData(null); // Reset MCTS data
        setMctsSummary(null);
        setAiProbability(null); // Reset AI probability
      } else {
        setMessage("Your turn");
        // Fetch the MCTS tree, summary, and AI's probability after AI moves
        await fetchMctsTree();
        await fetchMctsSummary();
        await fetchAiProbability();

        // Set selected node as AI's last move
        setSelectedNodeData(findNodeByAction(response.data.move)); // Use AI's last action
      }
    } catch (error) {
      console.error("Error with AI move:", error);
      setLoading(false); // Stop loading
      setMessage("Error with AI move.");
    }
  };

  const findNodeByAction = (action) => {
    // Recursive helper function to traverse MCTS tree and find the node by action
    const traverse = (node) => {
      if (!node) return null;
      if (
        node.action &&
        node.action[0] === action[0] &&
        node.action[1] === action[1]
      ) {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const result = traverse(child);
          if (result) return result;
        }
      }
      return null;
    };

    return mctsTreeData ? traverse(mctsTreeData) : null;
  };

  const fetchAiProbability = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/ai_probability`);
      console.log(response.data.probability_of_winning);
      setAiProbability(response.data.probability_of_winning);
    } catch (error) {
      console.error("Error fetching AI probability:", error);
    }
  };

  const fetchMctsTree = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/get_mcts_tree`, {
        params: { max_depth: treeDepth },
      });
      const mctsData = response.data.tree;
      if (!mctsData) {
        setMctsTreeData(null);
        return;
      }
      // Update maxN and maxV for normalization
      const { maxN, maxV } = getMaxNandV(mctsData);
      setMaxN(maxN);
      setMaxV(maxV);
      const transformedData = transformMctsData(mctsData, maxN, maxV);
      setMctsTreeData(transformedData);
    } catch (error) {
      console.error("Error fetching MCTS tree data:", error);
    }
  };

  const getMaxNandV = (node, currentMaxN = 0, currentMaxV = 0) => {
    if (!node) return { maxN: currentMaxN, maxV: currentMaxV };
    currentMaxN = Math.max(currentMaxN, node.N);
    currentMaxV = Math.max(currentMaxV, Math.abs(node.V));
    if (node.children) {
      node.children.forEach((child) => {
        const { maxN: childMaxN, maxV: childMaxV } = getMaxNandV(
          child,
          currentMaxN,
          currentMaxV
        );
        currentMaxN = childMaxN;
        currentMaxV = childMaxV;
      });
    }
    return { maxN: currentMaxN, maxV: currentMaxV };
  };

  const fetchMctsSummary = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/get_mcts_summary`);
      setMctsSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching MCTS summary:", error);
    }
  };

  const transformMctsData = (node, maxN, maxV) => {
    if (!node) return null;

    const children = node.children
      ? node.children.map((child) => transformMctsData(child, maxN, maxV))
      : [];

    return {
      name: node.action ? `(${node.action.join(", ")})` : "Root",
      id: node.id,
      N: node.N,
      V: node.V,
      prob: node.prob,
      isBestPath: node.is_best_path,
      action: node.action, // Preserve 'action' as an array
      children: children,
      maxN: maxN,
      maxV: maxV,
    };
  };

  const handleNodeSelect = (nodeData) => {
    setSelectedNodeData(nodeData);
  };

  return (
    <div className="App min-h-screen bg-gray-100 py-10 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold">AlphaZero - Tic Tac Toe</h1>
        <p className="text-lg">{message}</p>
      </div>

      {!gameStarted ? (
        // Pre-game Selection Screen
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-2xl font-semibold mb-6">Choose Your Order</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => startGame(1)} // Player goes first
              className="bg-gradient-to-r from-blue-400 to-blue-600 text-white px-6 py-3 rounded-full shadow-md hover:shadow-lg hover:from-blue-500 hover:to-blue-700 transition-transform transform hover:scale-105 duration-300"
            >
              Go First
            </button>
            <button
              onClick={() => startGame(-1)} // Player goes second
              className="bg-gradient-to-r from-green-400 to-green-600 text-white px-6 py-3 rounded-full shadow-md hover:shadow-lg hover:from-green-500 hover:to-green-700 transition-transform transform hover:scale-105 duration-300"
            >
              Go Second
            </button>
          </div>
        </div>
      ) : (
        // Main Game Content
        <div className="flex flex-col lg:flex-row">
          {/* Left Side: Game Board and Probability Chart */}
          <div className="w-full lg:w-1/3 flex flex-col items-center lg:pr-4">
            {/* Game Board */}
            <div className="w-full max-w-sm md:max-w-md lg:max-w-full -mt-24">
              <GameBoard board={board} onCellClick={onCellClick} />
            </div>

            {/* Loading Spinner */}
            {loading && (
              <div className="flex justify-center items-center mt-4">
                <ClipLoader color="#4A90E2" loading={loading} size={50} />
              </div>
            )}

            {/* Winner Message and New Game Button */}
            {winner !== null && (
              <div className="mt-6 flex flex-col items-center">
                <h2 className="text-2xl font-semibold mb-4">
                  {winner === 0
                    ? "It's a draw!"
                    : `Player ${winner === 1 ? "X" : "O"} wins!`}
                </h2>
                <button
                  onClick={() => setGameStarted(false)} // Return to selection screen
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
                >
                  Start New Game
                </button>
              </div>
            )}

            {/* AI Probability Chart */}
            {aiProbability !== null && (
              <div className="w-full max-w-sm md:max-w-md lg:max-w-full mt-6 flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-2">
                  AI's Probability of Winning
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={[
                      {
                        name: "AI",
                        value: aiProbability * 100,
                        fill: "#ff4d4f",
                      },
                      {
                        name: "You",
                        value: (1 - aiProbability) * 100,
                        fill: "#52c41a",
                      },
                    ]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      minAngle={15}
                      background
                      clockWise
                      dataKey="value"
                      cornerRadius={10}
                    />
                    <RechartsTooltip />
                    <Legend
                      iconSize={10}
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                    />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xl font-bold"
                    >
                      {`${(aiProbability * 100).toFixed(1)}%`}
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="flex justify-between w-full px-4 mt-2">
                  <p className="text-green-600 font-semibold">
                    You:{" "}
                    {(1 - aiProbability) * 100 < 1
                      ? "<1"
                      : ((1 - aiProbability) * 100).toFixed(1)}
                    %
                  </p>
                  <p className="text-red-600 font-semibold">
                    AI:{" "}
                    {aiProbability * 100 < 1
                      ? "<1"
                      : (aiProbability * 100).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            )}

            {/* Node Information Section */}
            {selectedNodeData && (
              <Card
                title="Node Information"
              >
                <p>
                  <strong>Action:</strong>{" "}
                  {selectedNodeData.action
                    ? `(${selectedNodeData.action[0]}, ${selectedNodeData.action[1]})`
                    : "Root"}
                </p>
                <p>
                  <strong>Visit Count (N):</strong> {selectedNodeData.N}
                </p>
                <p>
                  <strong>Value (V):</strong> {selectedNodeData.V.toFixed(2)}
                </p>
                <p>
                  <strong>Probability:</strong>{" "}
                  {selectedNodeData.prob
                    ? (selectedNodeData.prob * 100).toFixed(2) + "%"
                    : "N/A"}
                </p>
              </Card>
            )}

            {/* Summaries Section */}
            <Card
              title="MCTS Summary"
            >
              {mctsSummary ? (
                <div>
                  <p>
                    <strong>Total Nodes:</strong> {mctsSummary.total_nodes}
                  </p>
                  <p>
                    <strong>Average N:</strong>{" "}
                    {mctsSummary.average_N.toFixed(2)}
                  </p>
                  <p>
                    <strong>Average V:</strong>{" "}
                    {mctsSummary.average_V.toFixed(5)}
                  </p>
                </div>
              ) : (
                <p>No summary available.</p>
              )}
            </Card>
          </div>

          {/* Right Side: MCTS Tree */}
          <div className="w-full lg:w-2/3 mt-8 lg:mt-0 flex flex-col items-center">
            {mctsTreeData && (
              <div className="w-full">
                <h2 className="text-xl font-semibold mb-4 text-center">
                  AI's MCTS Tree (Click on a node to see its details.)
                </h2>
                <div className="flex flex-col items-center">
                  <div className="mt-4 flex items-center flex-wrap justify-center">
                    <label htmlFor="depth" className="mr-2">
                      Tree Depth:
                    </label>
                    <input
                      type="number"
                      id="depth"
                      value={treeDepth}
                      min={1}
                      max={5}
                      onChange={(e) => setTreeDepth(parseInt(e.target.value))}
                      className="border p-1 w-16 text-center mr-4 mb-2"
                    />
                    <button
                      onClick={fetchMctsTree}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200 mb-2"
                    >
                      Update Tree
                    </button>
                  </div>
                  <div className="w-full h-96 md:h-128 lg:h-full">
                    <MctsTree
                      data={mctsTreeData}
                      maxN={maxN}
                      maxV={maxV}
                      onNodeSelect={handleNodeSelect} // Pass the callback
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
