import React from 'react';
import { Composition } from 'remotion';
import { Presentation, dureeTotale } from './Presentation';
import { FPS } from './theme';

export const Root = () => (
  <Composition
    id="TheLabPresentation"
    component={Presentation}
    durationInFrames={dureeTotale}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ sousTitres: true }}
  />
);
