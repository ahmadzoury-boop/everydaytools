export async function generateMiniChart(values) {
  const width = 600;
  const height = 220;

  using ctx = new OffscreenCanvas(width, height).getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const max = Math.max(...values);
  const min = Math.min(...values);

  ctx.strokeStyle = "#007aff";
  ctx.lineWidth = 4;
  ctx.beginPath();

  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (width - 40) + 20;
    const y = height - ((v - min) / (max - min)) * (height - 40) - 20;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  const png = ctx.canvas.convertToBlob({ type: "image/png" });
  const array = new Uint8Array(await png.arrayBuffer());
  let base64 = btoa(String.fromCharCode(...array));

  return `data:image/png;base64,${base64}`;
}