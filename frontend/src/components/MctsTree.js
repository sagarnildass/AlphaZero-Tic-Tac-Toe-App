// src/components/MctsTree.js

import React from "react";
import Tree from "react-d3-tree";

const MctsTree = ({ data }) => {
  const containerStyles = {
    width: "100%",
    height: "500px",
    overflow: "auto",
  };

  const renderRectSvgNode = ({ nodeDatum, toggleNode }) => (
    <g>
      {/* Node rectangle */}
      <rect
        width="150"
        height="60"
        x="-75"
        y="-30"
        fill="#fff"
        stroke="#999"
        onClick={toggleNode}
      />
      {/* Node text */}
      <text
        fill="black"
        x="0"
        y="-10"
        textAnchor="middle"
        style={{ fontSize: "12px" }}
      >
        {nodeDatum.name.split("\n")[0]}
      </text>
      <text
        fill="black"
        x="0"
        y="10"
        textAnchor="middle"
        style={{ fontSize: "12px" }}
      >
        {nodeDatum.name.split("\n")[1]}
      </text>
    </g>
  );

  return (
    <div style={containerStyles}>
      <Tree
        data={data}
        orientation="vertical"
        renderCustomNodeElement={renderRectSvgNode}
        zoomable={true}
        collapsible={true}
        initialDepth={1}
      />
    </div>
  );
};

export default MctsTree;
