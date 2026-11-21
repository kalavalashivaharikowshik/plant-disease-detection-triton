// Copies the served ONNX model and the ONNX Runtime Web binaries into public/
// so the app can run the model in the browser (offline mode and live camera).
// The model's single source of truth stays in model_repository/.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "..");
const model = resolve(frontend, "../model_repository/plant_model/1/model.onnx");
const ortDist = resolve(frontend, "node_modules/onnxruntime-web/dist");

function copyIfChanged(src, dest) {
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) return false;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return true;
}

if (existsSync(model)) {
  if (copyIfChanged(model, join(frontend, "public/model/plant_model.onnx"))) {
    console.log("copied model -> public/model/plant_model.onnx");
  }
} else {
  console.warn(`model not found at ${model}; browser mode will be unavailable`);
}

if (existsSync(ortDist)) {
  for (const file of readdirSync(ortDist)) {
    if (/^ort-wasm-simd-threaded\.(jsep\.)?(wasm|mjs)$/.test(file)) {
      copyIfChanged(join(ortDist, file), join(frontend, "public/ort", file));
    }
  }
}
