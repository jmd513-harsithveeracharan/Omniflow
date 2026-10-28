import React from 'react';
import { PlatformCube } from './PlatformCube';

interface PlaygroundHomeProps {
  onSelectPrompt?: (prompt: string) => void;
}

export const PlaygroundHome: React.FC<PlaygroundHomeProps> = () => {
  return (
    <div className="playground-home" id="playgroundHome">
      <h1 className="playground-title" id="heroTagline">
        <PlatformCube platformId="fabric" size={32} />
        <span id="heroTaglineText">It's a late-night jam session.</span>
      </h1>
    </div>
  );
};
