import React, { useState, useEffect } from 'react';

// Define the props for Tooltip
interface TooltipProps {
  message: string;
  delay?: number; // Optional because it has a default value
}

const Tooltip: React.FC<TooltipProps> = ({ message, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`
        fixed left-0 p-4 bg-white rounded-r-lg shadow-lg border-l-4 border-blue-500
        transform transition-all duration-500 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
        max-w-xs
      `}
      style={{
        top: `${Math.max(50 + delay / 20, 20)}px`,
      }}
    >
      <p className="text-gray-800">{message}</p>
    </div>
  );
};

// Define the TooltipManager component
const TooltipManager: React.FC = () => {
  const tips = [
    { message: "👋 Welcome! Click any flashcard to flip it over", delay: 1000 },
    { message: "✨ Rate cards as Easy, Medium, or Hard to track your progress", delay: 3000 },
    { message: "📚 Create your own sets or import existing ones", delay: 5000 },
    { message: "🎯 Master cards by getting them right multiple times", delay: 7000 },
    { message: "🔄 Use the restart button to practice again", delay: 9000 }
  ];

  return (
    <div className="fixed left-0 top-0 z-50">
      {tips.map((tip, index) => (
        // Pass key to the Tooltip wrapper, not as part of Tooltip props
        <Tooltip key={index} message={tip.message} delay={tip.delay} />
      ))}
    </div>
  );
};

export default TooltipManager;
