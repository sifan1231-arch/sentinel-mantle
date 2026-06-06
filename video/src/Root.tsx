import React from "react";
import { Composition } from "remotion";
import { SentinelArena } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SentinelArena"
      component={SentinelArena}
      durationInFrames={2550}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
