import type { TaskTemplate } from "../types";
import { bus } from "./bus";
import { shop } from "./shop";
import { internet } from "./internet";
import { credit } from "./credit";
import { medicine } from "./medicine";
import { recipe } from "./recipe";
import { hay } from "./hay";
import { power } from "./power";

export const TEMPLATES: TaskTemplate[] = [bus, shop, internet, credit, medicine, recipe, hay, power];
