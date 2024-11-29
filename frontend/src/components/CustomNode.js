// src/components/CustomNode.js

import React from 'react';

const CustomNode = ({ data }) => {
  return (
    <div
      style={{
        background: data.background,
        width: data.width,
        height: data.height,
        border: data.border,
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000',
        position: 'relative',
        padding: '10px',
        boxSizing: 'border-box',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: data.isBestPath ? 'bold' : 'normal',
        boxShadow: data.isBestPath ? '0 0 10px #ff4500' : 'none',
        cursor: 'pointer',
      }}
    >
      {data.label}
      {data.isHighValue && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            color: 'red',
            fontSize: '20px',
          }}
        >
          ★
        </div>
      )}
    </div>
  );
};

export default CustomNode;
