export const RULE_SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short name for the rule" },
          description: {
            type: "string",
            description: "Full rule text to inject into review prompts",
          },
          category: {
            type: "string",
            description: "Category this rule applies to (e.g., 'correctness', 'style', 'architecture')",
          },
        },
        required: ["title", "description"],
      },
    },
  },
  required: ["rules"],
};
