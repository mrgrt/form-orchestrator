import { promises as fs } from "fs";
import path from "path";

import type { FormConfig } from "../types/index.js";

const FORM_KEY_PATTERN = /^[a-z0-9_-]+$/i;
const DEFAULT_CONFIG_DIR = path.join(process.cwd(), "src", "configs", "forms");

/**
 * Load a form config JSON file by `formKey` from disk.
 * Returns `null` when the key is invalid or the file is missing/unreadable.
 *
 * @param formKey   the file name (without `.json`) under `configDir`
 * @param configDir the directory to load from (defaults to
 *                  `<cwd>/src/configs/forms`)
 */
export async function loadFormConfig(
  formKey: string,
  configDir: string = DEFAULT_CONFIG_DIR,
): Promise<FormConfig | null> {
  if (!FORM_KEY_PATTERN.test(formKey)) return null;
  try {
    const raw = await fs.readFile(
      path.join(configDir, `${formKey}.json`),
      "utf-8",
    );
    return JSON.parse(raw) as FormConfig;
  } catch {
    return null;
  }
}
