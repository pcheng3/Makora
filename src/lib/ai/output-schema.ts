export const REVIEW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "1-3 sentence summary of what the diff does and overall quality assessment",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["issue", "question", "positive", "test_suggestion"],
            description: "Type of finding",
          },
          severity: {
            type: "string",
            enum: ["critical", "blocking", "suggestion", "nit"],
            description: "Severity level (only for category=issue)",
          },
          title: {
            type: "string",
            description: "Short descriptive title of the finding",
          },
          file_path: {
            type: "string",
            description: "File path relative to repo root",
          },
          line_start: {
            type: "integer",
            description: "Starting line number in the file",
          },
          line_end: {
            type: "integer",
            description:
              "Ending line number (same as start for single-line findings)",
          },
          code_snippet: {
            type: "string",
            description: "Relevant code from the diff",
          },
          description: {
            type: "string",
            description: "Detailed explanation of the finding",
          },
          proposed_fix: {
            type: "string",
            description:
              "Concrete suggestion with code when applicable",
          },
        },
        required: ["category", "title", "description"],
      },
    },
  },
  required: ["summary", "items"],
};
