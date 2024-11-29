// src/components/MctsTree.js

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Group } from "@visx/group";
import { Tree, hierarchy } from "@visx/hierarchy";
import { LinkVertical } from "@visx/shape";
import { Zoom } from "@visx/zoom";
import { LinearGradient } from "@visx/gradient";
import { scaleLinear } from "d3-scale";
import { interpolateWarm } from "d3-scale-chromatic";
import axios from "axios";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import "./MctsTree.css"; // Ensure this file includes necessary styles

const MctsTree = ({ data, maxN, maxV, mctsSummary }) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedNodeData, setSelectedNodeData] = useState(null); // For Node Information
  const [treeData, setTreeData] = useState(data);
  const svgRef = useRef(null);

  useEffect(() => {
    setTreeData(data);
  }, [data]);

  const width = 1200; // Increased width for better spacing
  const height = 800; // Increased height for better spacing
  const margin = { top: 40, left: 40, right: 40, bottom: 40 };

  const API_BASE_URL = "http://localhost:8000";

  // Scales for legends
  const colorScale = scaleLinear()
    .domain([-maxV, 0, maxV])
    .range(["#d73027", "#ffffbf", "#1a9850"]); // Red to Yellow to Green

  const sizeScale = scaleLinear().domain([1, maxN]).range([10, 30]); // Circle radii from 10 to 30

  // Function to interpolate node color based on V value
  const getNodeColor = (V) => {
    return colorScale(V);
  };

  // Function to interpolate node size based on N value
  const getNodeSize = (N) => {
    return sizeScale(N);
  };

  // Function to find and update a node in the tree data immutably
  const updateNodeInTree = (nodeData, targetId, updater) => {
    if (nodeData.id === targetId) {
      return updater(nodeData);
    }
    if (nodeData.children) {
      return {
        ...nodeData,
        children: nodeData.children.map((child) =>
          updateNodeInTree(child, targetId, updater)
        ),
      };
    }
    return nodeData;
  };

  // Handle node toggle for dynamic loading
  const handleNodeToggle = async (nodeData) => {
    if (nodeData.expanded) {
      // Collapse node
      const updatedTreeData = updateNodeInTree(
        treeData,
        nodeData.id,
        (node) => ({
          ...node,
          _children: node.children,
          children: null,
          expanded: false,
        })
      );
      setTreeData(updatedTreeData);
      setSelectedNodeData(null); // Clear selected node info on collapse
    } else {
      // Expand node
      if (nodeData._children) {
        // Node has cached children
        const updatedTreeData = updateNodeInTree(
          treeData,
          nodeData.id,
          (node) => ({
            ...node,
            children: node._children,
            _children: null,
            expanded: true,
          })
        );
        setTreeData(updatedTreeData);
      } else {
        // Fetch subtree from backend
        try {
          const response = await axios.get(`${API_BASE_URL}/get_mcts_subtree`, {
            params: { node_id: nodeData.id },
          });
          const subtree = response.data.tree;
          if (subtree) {
            // Transform subtree data
            const transformedSubtree = transformMctsData(subtree, maxN, maxV);
            const updatedTreeData = updateNodeInTree(
              treeData,
              nodeData.id,
              (node) => ({
                ...node,
                children: transformedSubtree.children,
                expanded: true,
              })
            );
            setTreeData(updatedTreeData);
          }
        } catch (error) {
          console.error("Error fetching MCTS subtree:", error);
        }
      }
    }
  };

  // Function to transform MCTS data
  const transformMctsData = (node, maxN, maxV, parentId = "root") => {
    if (!node) return null;

    const nodeId = parentId === "root" ? node.id : `${parentId}-${node.id}`;

    const nodeName = `N: ${node.N}, V: ${node.V.toFixed(2)}`;
    const children = node.children
      ? node.children.map((child) =>
          transformMctsData(child, maxN, maxV, nodeId)
        )
      : [];

    const action = node.action
      ? `Action: (${node.action[0]}, ${node.action[1]})`
      : "Root";

    return {
      name: `${action}\n${nodeName}`,
      id: nodeId, // Ensure unique ID
      action: node.action ? [node.action[0], node.action[1]] : null,
      N: node.N,
      V: node.V,
      prob: node.prob,
      isBestPath: node.is_best_path,
      children: children,
      expanded: node.expanded || false,
    };
  };

  const calculateMctsSummary = (node) => {
    let totalNodes = 0;
    let totalN = 0;
    let totalV = 0;

    const traverse = (currentNode) => {
      if (!currentNode) return;
      totalNodes += 1;
      totalN += currentNode.N;
      totalV += currentNode.V;
      if (currentNode.children) {
        currentNode.children.forEach((child) => traverse(child));
      }
      if (currentNode._children) {
        currentNode._children.forEach((child) => traverse(child));
      }
    };

    traverse(node);

    const averageN = totalNodes ? (totalN / totalNodes).toFixed(2) : 0;
    const averageV = totalNodes ? (totalV / totalNodes).toFixed(2) : 0;

    return { totalNodes, averageN, averageV };
  };

  // Inside the component
  const summary = useMemo(() => calculateMctsSummary(treeData), [treeData]);

  // Transform the data into hierarchy
  const root = useMemo(
    () => hierarchy(treeData, (d) => d.children || d._children),
    [treeData]
  );

  const renderNode = ({ node }) => {
    const isSelected = selectedNodeId === node.data.id;
    const isBestPath = node.data.isBestPath;

    const nodeColor = getNodeColor(node.data.V);
    const nodeSize = getNodeSize(node.data.N);

    // Tooltip content formatted as HTML
    const tooltipContent = `
      <div>
        ${
          node.data.action
            ? `<strong>Action:</strong> (${node.data.action[0]}, ${node.data.action[1]})<br/>`
            : ""
        }
        <strong>Visit Count (N):</strong> ${node.data.N}<br/>
        <strong>Value (V):</strong> ${node.data.V.toFixed(2)}<br/>
        <strong>Probability:</strong> ${
          node.data.prob ? (node.data.prob * 100).toFixed(2) + "%" : "N/A"
        }
      </div>
    `;

    return (
      <Group top={node.y} left={node.x}>
        {/* Node circle */}
        <circle
          r={nodeSize}
          fill={nodeColor}
          stroke={isSelected ? "#ff0" : isBestPath ? "#ff4500" : "#555"}
          strokeWidth={isSelected ? 3 : isBestPath ? 2 : 1}
          onClick={() => {
            setSelectedNodeId(node.data.id);
            setSelectedNodeData(node.data); // Set selected node data
            handleNodeToggle(node.data);
          }}
          style={{ cursor: "pointer" }}
          data-tip={tooltipContent}
        />
        {/* High-value node glow */}
        {Math.abs(node.data.V) === maxV && (
          <circle
            r={nodeSize + 5}
            fill="none"
            stroke="red"
            strokeWidth={2}
            strokeOpacity={0.6}
          />
        )}
      </Group>
    );
  };

  const renderLink = (link) => {
    const isBestPath = link.target.data.isBestPath;

    return (
      <LinkVertical
        data={link}
        stroke={isBestPath ? "#ff4500" : "#999"}
        strokeWidth={isBestPath ? 2 : 1}
        fill="none"
        strokeOpacity={isBestPath ? 1 : 0.6}
      />
    );
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "row", position: "relative" }}
    >
      {/* MCTS Tree Section */}
      <div style={{ flex: 3, position: "relative" }}>
        <Zoom
          width={width}
          height={height}
          scaleMin={0.1}
          scaleMax={2}
          wheelDelta={(event) => -event.deltaY / 500}
        >
          {(zoom) => (
            <div>
              <svg
                width={width}
                height={height}
                ref={svgRef}
                style={{ border: "1px solid #ddd" }}
              >
                {/* Background */}
                <LinearGradient id="lg" from="#fd9b93" to="#fe6e9e" />
                <rect width={width} height={height} fill="#f9f9f9" />
                <Group
                  top={margin.top}
                  left={margin.left}
                  transform={zoom.toString()}
                >
                  <Tree
                    root={root}
                    size={[
                      width - margin.left - margin.right,
                      height - margin.top - margin.bottom,
                    ]}
                    separation={(a, b) => (a.parent === b.parent ? 1 : 0.8)}
                  >
                    {(tree) => (
                      <Group>
                        <TransitionGroup component={null}>
                          {tree.links().map((link, i) => (
                            <CSSTransition
                              key={`link-${i}`}
                              timeout={300}
                              classNames="link"
                            >
                              <Group key={`link-${i}`}>
                                {renderLink(link)}
                              </Group>
                            </CSSTransition>
                          ))}
                        </TransitionGroup>
                        <TransitionGroup component={null}>
                          {tree.descendants().map((node, i) => (
                            <CSSTransition
                              key={`node-${i}`}
                              timeout={300}
                              classNames="node"
                            >
                              <Group key={`node-${i}`}>
                                {renderNode({ node })}
                              </Group>
                            </CSSTransition>
                          ))}
                        </TransitionGroup>
                      </Group>
                    )}
                  </Tree>
                </Group>
              </svg>
              {/* Zoom Controls */}
              <div
                className="zoom-controls"
                style={{ position: "absolute", top: 20, right: 20 }}
              >
                <button
                  onClick={() => {
                    zoom.scale({
                      scaleX: zoom.transformMatrix.scaleX * 1.2,
                      scaleY: zoom.transformMatrix.scaleY * 1.2,
                    });
                  }}
                  className="btn"
                >
                  +
                </button>
                <button
                  onClick={() => {
                    zoom.scale({
                      scaleX: zoom.transformMatrix.scaleX * 0.8,
                      scaleY: zoom.transformMatrix.scaleY * 0.8,
                    });
                  }}
                  className="btn"
                >
                  -
                </button>
                <button onClick={zoom.reset} className="btn">
                  Reset
                </button>
              </div>
            </div>
          )}
        </Zoom>
        {/* Tooltip Instance */}
        <ReactTooltip place="top" effect="solid" />
      </div>

      {/* Side Panel for MCTS Summary and Node Information */}
      <div
        style={{
          flex: 1,
          padding: "20px",
          borderLeft: "1px solid #ddd",
          overflowY: "auto",
          maxHeight: height,
        }}
      >
        {/* MCTS Summary Section */}
        <div style={{ marginBottom: "20px" }}>
          <h3 className="text-lg font-semibold mb-2">
            <strong>MCTS Summary</strong>
          </h3>
          <p>Total Nodes: {summary.totalNodes}</p>
          <p>Average Visit Count (N): {summary.averageN}</p>
          <p>Average Value (V): {summary.averageV}</p>
        </div>

        {mctsSummary && (
          <div style={{ marginBottom: "20px" }}>
            <h3 className="text-lg font-semibold mb-2">
              Full Visible State Summary
            </h3>
            <p>Total Nodes: {mctsSummary.total_nodes}</p>
            <p>Average N: {mctsSummary.average_N.toFixed(2)}</p>
            <p>Average V: {mctsSummary.average_V.toFixed(2)}</p>
          </div>
        )}

        {/* Node Information Section */}
        <div>
          <h2>Node Information</h2>
          {selectedNodeData ? (
            <div>
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
            </div>
          ) : (
            <p>Click on a node to see its details.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MctsTree;
