import type { TaskTemplate } from "../types";
import { bus } from "./bus";
import { shop } from "./shop";
import { internet } from "./internet";
import { credit } from "./credit";

export const TEMPLATES: TaskTemplate[] = [bus, shop, internet, credit];
