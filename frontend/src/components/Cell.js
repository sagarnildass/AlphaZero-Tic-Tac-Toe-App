import React from 'react';

const Cell = ({ row, col, value, onClick }) => {
  const handleClick = () => {
    onClick(row, col);
  };

  const renderValue = () => {
    if (value === 1) return <span className="text-red-500 text-lg sm:text-xl md:text-3xl animate-pop">&#10005;</span>;
    if (value === -1) return <span className="text-blue-500 text-lg sm:text-xl md:text-3xl animate-pop">&#9711;</span>;
    return '';
  };

  const cellClasses = `
    w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 
    flex items-center justify-center border 
    border-gray-400 text-lg sm:text-xl md:text-2xl lg:text-3xl 
    font-bold cursor-pointer 
    hover:bg-gray-200 transition duration-200
  `;

  return (
    <div className={cellClasses} onClick={handleClick}>
      {renderValue()}
    </div>
  );
};

export default Cell;
