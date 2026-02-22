export async function generateMiniChart(values) {
  const width = 600;
  const height = 220;

  // Create canvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Line chart logic
  const max = Math.max(...values);
  const min = Math.min(...values);

  ctx.strokeStyle = "#007aff"; // Apple blue
  ctx.lineWidth = 4;
  ctx.beginPath();

  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (width - 40) + 20;
    const y = height - ((v - min) / (max - min)) * (height - 40) - 20;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // Convert to base64
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const array = new Uint8Array(await blob.arrayBuffer());
  const base64 = btoa(String.fromCharCode(...array));

  return `data:image/png;base64,${base64}`;
}