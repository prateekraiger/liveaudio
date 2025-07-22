/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useEffect, useRef} from 'react';
import {Analyser} from './analyser';

interface Visuals3DProps {
  inputNode: AudioNode;
  outputNode: AudioNode;
}

export const GdmLiveAudioVisuals3D: React.FC<Visuals3DProps> = ({
  outputNode,
}) => {
  const visualizerRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<Analyser | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!outputNode) return;

    analyserRef.current = new Analyser(outputNode);
    const analyser = analyserRef.current;

    const animate = () => {
      if (visualizerRef.current && analyser) {
        analyser.update();
        const data = analyser.data;
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const average = sum / data.length / 255; // Normalize to 0-1

        // Apply a subtle pulsing effect to the circle
        const scale = 1 + average * 0.2; // Scale up to 20%
        visualizerRef.current.style.transform = `scale(${scale})`;
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [outputNode]);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    background: '#100c14', // Dark background
    zIndex: -1,
  };

  const circleStyle: React.CSSProperties = {
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(132,94,240,1) 0%, rgba(88,29,228,1) 100%)',
    boxShadow: '0 0 20px rgba(132,94,240,0.5), 0 0 60px rgba(132,94,240,0.3)',
    transition: 'transform 100ms ease-out',
    willChange: 'transform',
  };

  return React.createElement(
    'div',
    {style: containerStyle},
    React.createElement('div', {
      ref: visualizerRef,
      style: circleStyle,
    }),
  );
};
