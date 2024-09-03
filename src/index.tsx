import React from "react";

export interface CosmicPlayerProps {
  text: string;
}

const CosmicPlayer: React.FC<CosmicPlayerProps> = ({ text }) => {
  return (
    <div>
      Cosmic Player: <b style={{ color: "red" }}>{text}</b> updated
    </div>
  );
};

export default CosmicPlayer;
