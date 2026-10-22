/** The value space of a simulation variable. No objects or arrays by design. */
export type SimulationValue = number | boolean | string;

export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export type SimulationComparison = {
  kind: "compare";
  variable: string;
  op: ComparisonOperator;
  value: SimulationValue;
};

/**
 * Conditions are deliberately tiny: one comparison, or one and/or group of
 * comparisons. There is no function call, property access or expression string,
 * so an activity definition can never execute code.
 */
export type SimulationCondition =
  | SimulationComparison
  | {
      kind: "group";
      op: "and" | "or";
      conditions: SimulationComparison[];
    };

export type SimulationValues = Record<string, SimulationValue>;

function compare(
  comparison: SimulationComparison,
  values: SimulationValues,
): boolean {
  const actual = values[comparison.variable];
  switch (comparison.op) {
    case "eq":
      return actual === comparison.value;
    case "neq":
      return actual !== comparison.value;
    case "gt":
      return typeof actual === "number" &&
        typeof comparison.value === "number"
        ? actual > comparison.value
        : false;
    case "gte":
      return typeof actual === "number" &&
        typeof comparison.value === "number"
        ? actual >= comparison.value
        : false;
    case "lt":
      return typeof actual === "number" &&
        typeof comparison.value === "number"
        ? actual < comparison.value
        : false;
    case "lte":
      return typeof actual === "number" &&
        typeof comparison.value === "number"
        ? actual <= comparison.value
        : false;
  }
}

/** Missing conditions mean "always available". */
export function conditionHolds(
  condition: SimulationCondition | undefined,
  values: SimulationValues,
): boolean {
  if (!condition) return true;
  if (condition.kind === "compare") return compare(condition, values);
  const results = condition.conditions.map((item) => compare(item, values));
  return condition.op === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}

/** Human-readable condition used by the teacher editor and activity summary. */
export function describeCondition(
  condition: SimulationCondition,
  labelOf: (variableId: string) => string,
): string {
  if (condition.kind === "compare") {
    return `${labelOf(condition.variable)} ${condition.op} ${String(condition.value)}`;
  }
  return condition.conditions
    .map((item) => describeCondition(item, labelOf))
    .join(` ${condition.op} `);
}
