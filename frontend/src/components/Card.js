const Card = ({ title, children }) => (
  <div
    className={`relative w-full max-w-sm md:max-w-md lg:max-w-full p-6 rounded-lg shadow-lg mt-4 bg-gradient-to-r from-gray-700 via-rose-500 to-orange-400`}
    style={{
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}
  >
    <h3 className="text-2xl font-bold text-white mb-4 tracking-wide">
      {title}
    </h3>
    <div className="text-white text-base leading-relaxed">{children}</div>
  </div>
);

export default Card;
