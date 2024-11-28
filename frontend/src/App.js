// src/App.js

import React, { useState, useEffect } from "react";
import GameBoard from "./components/GameBoard";
import axios from "axios";
import { ClipLoader } from "react-spinners";
import MctsTree from "./components/MctsTree";
import {
  RadialBarChart,
  RadialBar,
  Legend,
  Tooltip,
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

  const API_BASE_URL = "http://localhost:8000";

  useEffect(() => {
    startGame();
  }, []);

  const startGame = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/start_game`);
      setBoard(response.data.board);
      setPlayer(response.data.player);
      setWinner(null);
      setMessage("Game started! You're player X");
      setMctsTreeData(null); // Reset MCTS data
      setMctsSummary(null);
      setAiProbability(null); // Reset AI probability
    } catch (error) {
      console.error("Error starting game:", error);
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
        setMessage(
          `Player ${response.data.winner === 1 ? "X" : "O"} wins!`
        );
        setMctsTreeData(null); // Reset MCTS data
        setMctsSummary(null);
        setAiProbability(null); // Reset AI probability
      } else {
        setMessage("AI's turn...");
        // AI makes a move
        await aiMove();
        // Fetch AI's probability after the AI moves
        await fetchAiProbability();
      }
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
        setMessage(
          `Player ${response.data.winner === 1 ? "X" : "O"} wins!`
        );
        setMctsTreeData(null); // Reset MCTS data
        setMctsSummary(null);
        setAiProbability(null); // Reset AI probability
      } else {
        setMessage("Your turn");
        // Fetch the MCTS tree, summary, and AI's probability after AI moves
        await fetchMctsTree();
        await fetchMctsSummary();
        await fetchAiProbability();
      }
    } catch (error) {
      console.error("Error with AI move:", error);
      setLoading(false); // Stop loading
    }
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
      const transformedData = transformMctsData(mctsData);
      setMctsTreeData(transformedData);
    } catch (error) {
      console.error("Error fetching MCTS tree data:", error);
    }
  };

  const fetchMctsSummary = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/get_mcts_summary`);
      setMctsSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching MCTS summary:", error);
    }
  };

  const transformMctsData = (node) => {
    if (!node) return null;

    const nodeName = `N: ${node.N}, V: ${node.V.toFixed(2)}`;
    const children = node.children
      ? node.children.map((child) => transformMctsData(child))
      : [];

    const action = node.action
      ? `Action: [${node.action.join(", ")}]`
      : "Root";

    return {
      name: `${action}\n${nodeName}`,
      id: node.id,
      children: children,
    };
  };

  return (
    <div className="App min-h-screen bg-gray-100 flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold mb-4">ConnectN Game</h1>
      <p className="text-lg mb-4">{message}</p>
      <GameBoard board={board} onCellClick={onCellClick} />
      {loading && (
        <div className="flex justify-center items-center mt-4">
          <ClipLoader color="#4A90E2" loading={loading} size={50} />
        </div>
      )}
      {winner !== null && (
        <div className="mt-6 flex flex-col items-center">
          <h2 className="text-2xl font-semibold mb-4">
            {winner === 0
              ? "It's a draw!"
              : `Player ${winner === 1 ? "X" : "O"} wins!`}
          </h2>
          <button
            onClick={startGame}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
          >
            Start New Game
          </button>
        </div>
      )}
      {aiProbability !== null && (
        <div className="w-full max-w-md mt-6 flex flex-col items-center">
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
              <Tooltip />
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
              You: {(1 - aiProbability) * 100 < 1 ? "<1" : ((1 - aiProbability) * 100).toFixed(1)}%
            </p>
            <p className="text-red-600 font-semibold">
              AI: {aiProbability * 100 < 1 ? "<1" : (aiProbability * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
      {mctsTreeData && (
        <div className="mt-6 w-full overflow-auto">
          <h2 className="text-xl font-semibold mb-4 text-center">
            AI's MCTS Tree
          </h2>
          <div className="flex flex-col items-center">
            <div className="mt-4 flex items-center">
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
                className="border p-1 w-16 text-center"
              />
              <button
                onClick={fetchMctsTree}
                className="ml-4 bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition duration-200"
              >
                Update Tree
              </button>
            </div>
            <MctsTree data={mctsTreeData} />
            {mctsSummary && (
              <div className="mt-4 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  MCTS Summary
                </h3>
                <p>Total Nodes: {mctsSummary.total_nodes}</p>
                <p>
                  Average N: {mctsSummary.average_N.toFixed(2)}
                </p>
                <p>
                  Average V: {mctsSummary.average_V.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
