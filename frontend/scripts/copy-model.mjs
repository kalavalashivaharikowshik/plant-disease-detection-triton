// Copies the served ONNX model into public/ so the app can run it in the browser
// (offline mode and live camera). ONNX Runtime's wasm is bundled by Vite.
// The model's single source of truth stays in model_repository/.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "..");
const model = resolve(frontend, "../model_repository/plant_model/1/model.onnx");

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
