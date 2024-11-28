// src/components/GameBoard.js

import React from 'react';
import Cell from './Cell';

const GameBoard = ({ board, onCellClick }) => {
  return (
    <div className="flex flex-col items-center">
      {board.map((row, rowIndex) => (
        <div className="flex" key={rowIndex}>
          {row.map((cellValue, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              value={cellValue}
              onClick={onCellClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default GameBoard;
