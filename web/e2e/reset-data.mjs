// Fresh, empty test data for every run. Only ever touches .data-e2e/.
import { rmSync } from "node:fs";

rmSync(new URL("../.data-e2e", import.meta.url), { recursive: true, force: true });
