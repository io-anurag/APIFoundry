import { runChainedWorkflow } from "./lib/workflow.js";

// 50 VUs, each independently running the full chained workflow exactly once (data-model.md:
// concurrent-user = 50 VU chained workflows). "per-vu-iterations" runs `iterations` per VU (not
// shared/divided across VUs), which is what "each VU independently once" requires. VUs each
// creating and deleting their own disposable user (k6/lib/workflow.js) means concurrent iterations
// never contend over the same row.
export const options = {
  scenarios: {
    default: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 1,
    },
  },
};

export default function () {
  runChainedWorkflow();
}
