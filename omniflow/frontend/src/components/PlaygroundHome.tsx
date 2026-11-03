import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlatformCube } from './PlatformCube';

interface PlaygroundHomeProps {
  onSelectPrompt?: (prompt: string) => void;
}

const QUOTES: string[] = [
  "It's a late-night jam session.",
  'Simplicity is the soul of efficiency.',
  'Data flows where creative minds meet.',
  'Architecture is frozen music in motion.',
  'Simple solutions outlast all clever code.',
  'Turn raw data into pure insight.',
  'Build with clarity, deliver with purpose.',
  'Every clean dataset tells a story.',
  'Where curiosity meets enterprise data flow.',
  'Great pipelines flow like silent poetry.',
  'Design with vision, build with precision.',
  'Transforming chaos into structured analytical elegance.',
  'Ideas take shape one prompt away.',
  'Clarity begins where complex data aligns.',
  'Elegance is the ultimate engineering goal.',
  'Good architecture makes hard problems easy.',
  'Curiosity unlocks what raw data hides.',
  'Mastery is simplicity on the far side.',
  'Quiet confidence builds the strongest foundations.',
  'Crafting the future of enterprise intelligence.',
  'Where raw data becomes living knowledge.',
  'Precision engineering meets effortless creative flow.',
  'Order emerges from well designed streams.',
  'Think cleanly, build boldly, iterate daily.',
  'Every great system begins with clarity.',
  'Code less, architect more, deliver faster.',
  'Pure telemetry turned into actionable truth.',
  'Speed and stability can dance together.',
  'What will we discover together today?',
  'Quiet hours build the greatest architectures.',
];

export const PlaygroundHome: React.FC<PlaygroundHomeProps> = () => {
  const [index, setIndex] = useState<number>(0);
  const [isFading, setIsFading] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const rotateToNext = useCallback(() => {
    setIsFading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length);
      setIsFading(false);
    }, 350);
  }, []);

  useEffect(() => {
    // Pick an initial quote based on current hour for natural context
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      setIndex(0); // Late night jam session
    } else {
      setIndex(Math.floor(Math.random() * QUOTES.length));
    }
  }, []);

  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      rotateToNext();
    }, 7500);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isHovered, rotateToNext]);

  return (
    <div className="playground-home" id="playgroundHome">
      <h1 className="playground-title" id="heroTagline">
        <PlatformCube platformId="fabric" size={32} />
        <span
          id="heroTaglineText"
          className={`playground-tagline-text ${isFading ? 'fade-out' : 'fade-in'}`}
          onClick={rotateToNext}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Click for another thought"
        >
          {QUOTES[index]}
        </span>
      </h1>
    </div>
  );
};

export default PlaygroundHome;
