from __future__ import annotations

import json
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from omniflow.agents.orchestrator import MultiAgentOrchestrator
from omniflow.agents.schemas import NaturalLanguagePlanRequest


def main() -> None:
    request = None
    intake_file = None
    resume = "--resume" in sys.argv
    cleaned_argv = [a for a in sys.argv[1:] if a != "--resume"]
    if cleaned_argv:
        arg_str = " ".join(cleaned_argv).strip()
        if "--intake" in cleaned_argv:
            idx = cleaned_argv.index("--intake")
            if idx + 1 < len(cleaned_argv):
                intake_file = cleaned_argv[idx + 1]
        elif arg_str.endswith(".json") and os.path.exists(arg_str):
            intake_file = arg_str
        else:
            request = NaturalLanguagePlanRequest(
                project_code="PRJ-AUTONOMOUS-DATA-ENG",
                project_name="Autonomous Microsoft Fabric Data Platform",
                prompt_text=arg_str,
                requested_by="harsith.bheesetti@pelibiothermal.com",
                reset_synthesized_tools=not resume,
            )

    orchestrator = MultiAgentOrchestrator()
    result = orchestrator.run_pipeline(req=request, intake_file=intake_file, resume=resume)

    out_file = os.path.join(current_dir, "test_run_result.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, default=str)
    print(f"\n[DONE] Wrote verified execution summary to: {out_file}")


if __name__ == "__main__":
    main()
