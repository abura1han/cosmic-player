// Function to fetch a portion of the video using byte range requests
export const fetchPartialVideo = async (
  url: string,
  startByte: number,
  endByte: number
): Promise<Uint8Array> => {
  const response = await fetch(url, {
    headers: {
      Range: `bytes=${startByte}-${endByte}`, // Request specific byte range
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch video segment: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer); // Convert to Uint8Array for FFmpeg
};