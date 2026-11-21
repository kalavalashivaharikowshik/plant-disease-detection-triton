"""Expose the last convolutional feature map of the classifier as a second ONNX output.

The served EfficientNet-B0 model ends with:
    ... -> Mul (features, N x 1280 x 7 x 7) -> GlobalAveragePool -> Flatten -> Gemm (logits)

Class Activation Maps (heatmaps) need that feature map plus the final Gemm weights.
This script:
  1. adds an ``Identity`` node that publishes the feature map as output ``features``;
  2. writes the classifier head (Gemm weight + bias) to ``classifier_head.npz`` so the
     backend can build heatmaps no matter which engine (ONNX Runtime or Triton) ran the model.

Weights are untouched, so predictions are bit-for-bit identical. Safe to run repeatedly.

Usage:
    python scripts/add_features_output.py \
        --model model_repository/plant_model/1/model.onnx \
        --head backend/app/assets/classifier_head.npz
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

FEATURES_OUTPUT = "features"


def find_feature_tensor(graph: onnx.GraphProto) -> str:
    """Return the input tensor of the final GlobalAveragePool (the last feature map)."""
    pools = [n for n in graph.node if n.op_type == "GlobalAveragePool"]
    if not pools:
        raise SystemExit("No GlobalAveragePool found; unsupported model architecture")
    return pools[-1].input[0]  # earlier pools belong to squeeze-and-excitation blocks


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--head", type=Path, required=True)
    args = parser.parse_args()

    model = onnx.load(args.model)
    graph = model.graph
    output_names = [o.name for o in graph.output]

    if FEATURES_OUTPUT not in output_names:
        feature_tensor = find_feature_tensor(graph)
        graph.node.append(helper.make_node("Identity", [feature_tensor], [FEATURES_OUTPUT]))
        graph.output.append(
            helper.make_tensor_value_info(
                FEATURES_OUTPUT, TensorProto.FLOAT, ["batch_size", 1280, 7, 7]
            )
        )
        onnx.checker.check_model(model)
        onnx.save(model, args.model)
        print(f"Added '{FEATURES_OUTPUT}' output ({feature_tensor}) -> {args.model}")
    else:
        print(f"'{FEATURES_OUTPUT}' output already present in {args.model}")

    gemm = [n for n in graph.node if n.op_type == "Gemm"][-1]
    inits = {i.name: numpy_helper.to_array(i) for i in graph.initializer}
    weight = inits[gemm.input[1]].astype(np.float32)
    bias = inits[gemm.input[2]].astype(np.float32)
    trans_b = next((a.i for a in gemm.attribute if a.name == "transB"), 0)
    if not trans_b:
        weight = weight.T  # store as (num_classes, channels)
    args.head.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(args.head, weight=weight, bias=bias)
    print(f"Saved classifier head {weight.shape} -> {args.head}")


if __name__ == "__main__":
    main()
