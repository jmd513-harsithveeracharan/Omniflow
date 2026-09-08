import React from 'react';

interface PlaygroundHomeProps {
  onSelectPrompt?: (prompt: string) => void;
}

export const PlaygroundHome: React.FC<PlaygroundHomeProps> = () => {
  return (
    <div className="playground-home" id="playgroundHome">
      <h1 className="playground-title" id="heroTagline">
        <img
          src="/assets/logos/abstract-shape(1).png"
          alt="Brand Logo"
          className="playground-title-logo"
          id="playgroundTitleLogo"
        />
        <span id="heroTaglineText">It's a late-night jam session.</span>
      </h1>
    </div>
  );
};
