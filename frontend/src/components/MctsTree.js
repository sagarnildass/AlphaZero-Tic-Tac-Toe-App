// src/components/MctsTree.js

import React, { useMemo, useRef } from "react";
import { Group } from "@visx/group";
import { Tree as VisxTree, hierarchy } from "@visx/hierarchy";
import { LinkVertical } from "@visx/shape";
import { Zoom } from "@visx/zoom";
import { LinearGradient } from "@visx/gradient";
import { scaleLinear } from "d3-scale";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import "./MctsTree.css"; // Ensure this file includes necessary styles

const MctsTree = ({ data, maxN, maxV, onNodeSelect }) => {
  const svgRef = useRef(null);
  const margin = { top: 40, left: 40, right: 40, bottom: 40 };

  // Scales for node coloring and sizing
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

  // Transform the data into hierarchy
  const root = useMemo(
    () => hierarchy(data, (d) => d.children || d._children),
    [data]
  );

  const renderNode = ({ node }) => {
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
          stroke={node.data.isSelected ? "#ff0" : node.data.isBestPath ? "#ff4500" : "#555"}
          strokeWidth={node.data.isSelected ? 3 : node.data.isBestPath ? 2 : 1}
          onClick={() => {
            onNodeSelect(node.data); // Communicate selected node to App.js
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
    <div className="flex flex-col items-center w-full">
      {/* Tree Visualization */}
      <div className="w-full h-96 md:h-128 lg:h-full">
        <Zoom
          width={1200} // Placeholder; consider using responsive techniques
          height={800}
          scaleMin={0.1}
          scaleMax={2}
          wheelDelta={(event) => -event.deltaY / 500}
        >
          {(zoom) => (
            <div className="w-full h-full relative">
              <svg
                width="100%"
                height="100%"
                ref={svgRef}
                style={{ border: "1px solid #ddd" }}
                viewBox={`0 0 1200 800`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Background */}
                <LinearGradient id="lg" from="#fd9b93" to="#fe6e9e" />
                <rect width="100%" height="100%" fill="#f9f9f9" />
                <Group
                  top={margin.top}
                  left={margin.left}
                  transform={zoom.toString()}
                >
                  <VisxTree
                    root={root}
                    size={[
                      1200 - margin.left - margin.right,
                      800 - margin.top - margin.bottom,
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
                  </VisxTree>
                </Group>
              </svg>
              {/* Zoom Controls */}
              <div className="zoom-controls absolute top-4 right-4 flex space-x-2">
                <button
                  onClick={() => {
                    zoom.scale({
                      scaleX: zoom.transformMatrix.scaleX * 1.2,
                      scaleY: zoom.transformMatrix.scaleY * 1.2,
                    });
                  }}
                  className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 transition duration-200"
                  aria-label="Zoom In"
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
                  className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 transition duration-200"
                  aria-label="Zoom Out"
                >
                  -
                </button>
                <button
                  onClick={zoom.reset}
                  className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 transition duration-200"
                  aria-label="Reset Zoom"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </Zoom>
      </div>

      {/* Tooltip Instance */}
      <ReactTooltip place="top" effect="solid" />
    </div>
  );
};

export default MctsTree;
