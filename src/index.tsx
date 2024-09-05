import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import React, { useEffect, useRef, useState } from "react";
import { fetchPartialVideo } from "./utils/load";

export interface CosmicPlayerProps {
  videoSrc: string;
}

const CosmicPlayer: React.FC<CosmicPlayerProps> = ({ videoSrc }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [currentSegment, setCurrentSegment] = useState(0); // Track video segment
  const ffmpegRef = useRef<FFmpeg>(new FFmpeg());
  const messageRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const animationRef = useRef<number | null>(null);
  let angle = 0;

  // Segment duration in seconds (adjustable)
  const SEGMENT_DURATION = 3; // Adjust this value to change segment duration
  const BYTES_PER_SECOND = 500000; // Approximate video bitrate in bytes per second

  const loadSegment = async (startTime: number) => {
    setIsLoading(true);
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    const ffmpeg = ffmpegRef.current;

    try {
      // Ensure FFmpeg is loaded only once
      if (!ffmpeg.loaded) {
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        });
      }

      // Calculate byte range based on start time and segment duration
      const startByte = startTime * BYTES_PER_SECOND;
      const endByte = (startTime + SEGMENT_DURATION) * BYTES_PER_SECOND - 1;

      // Fetch the portion of the video
      const videoChunk = await fetchPartialVideo(videoSrc, startByte, endByte);

      // Write partial video data to FFmpeg
      await ffmpeg.writeFile("input.mp4", videoChunk);

      // Process only this segment in FFmpeg
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-ss",
        "0", // Start at 0 of the partial video
        "-t",
        SEGMENT_DURATION.toString(), // Duration to extract (adjustable)
        "output_%03d.png",
      ]);

      // List generated files
      const files = await ffmpeg.listDir("/");
      const frameFiles = files.filter((file) =>
        file.name.startsWith("output_")
      );

      // Convert each frame to a Blob URL
      const loadedFrames: string[] = [];
      for (const file of frameFiles) {
        try {
          const frame = await ffmpeg.readFile(file.name);
          const blob = new Blob([frame], { type: "image/png" });
          const url = URL.createObjectURL(blob);
          loadedFrames.push(url);
        } catch (readError) {
          console.error("Error reading frame:", file.name, readError);
        }
      }

      setFrames((prevFrames) => [...prevFrames, ...loadedFrames]); // Append new frames
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load FFmpeg segment:", error);
      setIsLoading(false);
    }
  };

  const drawLoader = (ctx: CanvasRenderingContext2D, angle: number) => {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radius = 40;
    const lineWidth = 8;

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw the circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + Math.PI * 1.5);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const animateLoader = (ctx: CanvasRenderingContext2D) => {
    drawLoader(ctx, angle);
    angle += 0.05; // Adjust the rotation speed
    if (angle >= 2 * Math.PI) {
      angle = 0; // Reset the angle after a full rotation
    }
    animationRef.current = requestAnimationFrame(() => animateLoader(ctx));
  };

  useEffect(() => {
    // Load the first segment initially
    loadSegment(0);
  }, [videoSrc]);

  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      let frameIndex = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      const renderFrame = () => {
        if (frameIndex < frames.length) {
          const img = new Image();
          img.src = frames[frameIndex];
          img.onload = () => {
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
          };
          frameIndex++;

          // Load the next segment when nearing the end of the current frames
          if (frameIndex === frames.length - 10) {
            setCurrentSegment((prev) => prev + 1);
            loadSegment((currentSegment + 1) * SEGMENT_DURATION);
          }

          requestAnimationFrame(renderFrame);
        } else {
          setIsPlaying(false);
        }
      };

      renderFrame();
    }
  }, [isPlaying, frames]);

  useEffect(() => {
    if (!isLoading) return;

    const canvas = loadingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        animateLoader(ctx);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current); // Clean up the animation on component unmount
      }
    };
  }, [isLoading]);

  return (
    <div style={{ position: "relative" }}>
      {isLoading && (
        <canvas
          ref={loadingCanvasRef}
          width={640}
          height={360}
          style={{ border: "1px solid black", position: "absolute", top: 0, left: 0 }}
        ></canvas>
      )}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        style={{ border: "1px solid black" }}
      ></canvas>
      <div>
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <div ref={messageRef}></div>
    </div>
  );
};

export default CosmicPlayer;
