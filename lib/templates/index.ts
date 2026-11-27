import type { TaskTemplate } from "../types";
import { bus } from "./bus";
import { shop } from "./shop";
import { internet } from "./internet";
import { credit } from "./credit";
import { medicine } from "./medicine";
import { recipe } from "./recipe";
import { hay } from "./hay";
import { power } from "./power";
import { weather } from "./weather";
import { map } from "./map";

export const TEMPLATES: TaskTemplate[] = [bus, shop, internet, credit, medicine, recipe, hay, power, weather, map];
