import { runChainedWorkflow } from "./lib/workflow.js";

// A single end-to-end pass through FR-008's chained-workflow sequence, for direct
// demonstration/CI smoke use. See k6/lib/workflow.js for the actual sequence.
export const options = { vus: 1, iterations: 1 };

export default function () {
  runChainedWorkflow();
}
